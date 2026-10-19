import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma';
import { ScoresService } from '../scores/scores.service';

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly scoresService: ScoresService,
  ) {}

  /**
   * Get organization-wide dashboard statistics
   */
  async getOrganizationStats(organizationId: string) {
    // Get counts
    const [totalRepositories, totalTeams, totalProjects, totalCommits, bugFixCommits] =
      await Promise.all([
        this.prisma.repository.count({ where: { organizationId, isEnabled: true } }),
        this.prisma.team.count({ where: { organizationId, isActive: true } }),
        this.prisma.project.count({ where: { organizationId, isActive: true } }),
        this.prisma.commit.count({
          where: { repository: { organizationId } },
        }),
        this.prisma.commit.count({
          where: { repository: { organizationId }, classification: 'BUGFIX' },
        }),
      ]);

    // Get total developers (users who are members of this organization)
    const totalDevelopers = await this.prisma.organizationMember.count({
      where: { organizationId },
    });

    // Get average coverage from latest reports
    const repos = await this.prisma.repository.findMany({
      where: { organizationId, isEnabled: true },
      select: { id: true },
    });
    const repoIds = repos.map((r) => r.id);
    const coverages = await Promise.all(
      repoIds.map(async (repositoryId) => {
        return this.prisma.coverageReport.findFirst({
          where: { repositoryId, status: 'COMPLETED' },
          orderBy: { createdAt: 'desc' },
          select: { coveragePercentage: true },
        });
      })
    );
    const latestCoverages = coverages.filter((c) => c !== null);

    const avgCoverage =
      latestCoverages.length > 0
        ? latestCoverages.reduce((sum, r) => sum + (r.coveragePercentage || 0), 0) /
          latestCoverages.length
        : 0;

    // Get organization-wide SQS (combining projects and standalone scored repositories)
    const projects = await this.prisma.project.findMany({
      where: { organizationId, isActive: true },
      select: { id: true },
    });

    const projectIds = projects.map((p) => p.id);
    const candidateEntityIds = [...projectIds];

    // Also include enabled repositories that are not linked to any project
    const projectRepos = this.prisma.projectRepository?.findMany
      ? await this.prisma.projectRepository.findMany({
          where: { repository: { organizationId } },
          select: { repositoryId: true },
        })
      : [];
    const linkedRepoIds = new Set(projectRepos.map((pr) => pr.repositoryId));
    const standaloneRepoIds = repoIds.filter((id) => !linkedRepoIds.has(id));

    candidateEntityIds.push(...standaloneRepoIds);

    let avgSQS = 0;
    if (candidateEntityIds.length > 0) {
      const scores = await Promise.all(
        candidateEntityIds.map(async (entityId) => {
          let scoreRecord = await this.prisma.sQSScore.findFirst({
            where: { projectId: entityId },
            orderBy: { calculatedAt: 'desc' },
            select: { score: true },
          });

          // If standalone repo has commits but no score yet, calculate on-demand
          if (!scoreRecord && standaloneRepoIds.includes(entityId)) {
            const commitCount = await this.prisma.commit.count({
              where: { repositoryId: entityId },
            });
            if (commitCount > 0) {
              try {
                const calculated = await this.scoresService.calculateSQS(entityId, organizationId);
                if (calculated && typeof calculated.score === 'number') {
                  scoreRecord = { score: calculated.score };
                }
              } catch (calcErr) {
                this.logger.warn(`Failed on-demand SQS calculation for entity ${entityId}: ${calcErr}`);
              }
            }
          }

          return scoreRecord;
        }),
      );
      const entityScores = scores.filter((s) => s !== null && (s.score || 0) > 0);

      avgSQS =
        entityScores.length > 0
          ? entityScores.reduce((sum, s) => sum + (s?.score || 0), 0) / entityScores.length
          : 0;
    }

    // Get risky modules count from alerts
    const riskyModulesCount = await this.prisma.alert.count({
      where: {
        organizationId,
        status: 'OPEN',
        severity: { in: ['HIGH', 'CRITICAL'] },
      },
    });

    return {
      totalRepositories,
      totalTeams,
      totalDevelopers,
      totalProjects,
      totalCommits,
      bugFixCommits,
      avgCoverage: Number(avgCoverage.toFixed(1)),
      avgSQS: Number(avgSQS.toFixed(1)),
      riskyModulesCount,
    };
  }

  /**
   * Get SQS trend over time for organization
   */
  async getSQSTrend(organizationId: string, days: number = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const projects = await this.prisma.project.findMany({
      where: { organizationId, isActive: true },
      select: { id: true },
    });

    const projectIds = projects.map((p) => p.id);

    if (projectIds.length === 0) return [];

    const scores = await this.prisma.sQSScore.findMany({
      where: {
        projectId: { in: projectIds },
        calculatedAt: { gte: startDate },
      },
      orderBy: { calculatedAt: 'asc' },
      select: {
        score: true,
        calculatedAt: true,
      },
    });

    // Group by date and average
    const grouped = scores.reduce(
      (acc, s) => {
        const date = s.calculatedAt.toISOString().split('T')[0];
        if (!acc[date]) acc[date] = { total: 0, count: 0 };
        acc[date].total += s.score || 0;
        acc[date].count += 1;
        return acc;
      },
      {} as Record<string, { total: number; count: number }>,
    );

    return Object.entries(grouped).map(([date, { total, count }]) => ({
      date,
      value: Number((total / count).toFixed(1)),
    }));
  }

  /**
   * Get commit activity trend
   */
  async getCommitTrend(organizationId: string, days: number = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const commits = await this.prisma.commit.findMany({
      where: {
        repository: { organizationId },
        committedAt: { gte: startDate },
      },
      select: { committedAt: true },
    });

    // Group by date
    const grouped = commits.reduce(
      (acc, c) => {
        const date = c.committedAt.toISOString().split('T')[0];
        acc[date] = (acc[date] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    return Object.entries(grouped)
      .map(([date, count]) => ({ date, value: count }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  /**
   * Get top repositories by SQS
   */
  async getTopRepositories(organizationId: string, limit: number = 5) {
    const repos = await this.prisma.repository.findMany({
      where: { organizationId, isEnabled: true },
      include: {
        _count: { select: { commits: true } },
      },
      take: 50,
    });

    // Get latest coverage and SQS for each repo
    const repoScores = await Promise.all(
      repos.map(async (repo) => {
        // 1. Direct repository SQS check
        let latestScore = await this.prisma.sQSScore.findFirst({
          where: { projectId: repo.id },
          orderBy: { calculatedAt: 'desc' },
          select: { score: true },
        });

        // 2. Fall back to parent project score if repo is linked to a project
        if (!latestScore) {
          const projectRepo = await this.prisma.projectRepository.findFirst({
            where: { repositoryId: repo.id },
            select: { projectId: true },
          });

          if (projectRepo) {
            latestScore = await this.prisma.sQSScore.findFirst({
              where: { projectId: projectRepo.projectId },
              orderBy: { calculatedAt: 'desc' },
              select: { score: true },
            });
          }
        }

        let sqs = latestScore?.score || 0;

        // 3. On-demand calculation if repository has commits but no score yet
        if (sqs === 0 && repo._count.commits > 0) {
          try {
            const calculated = await this.scoresService.calculateSQS(repo.id, organizationId);
            if (calculated && typeof calculated.score === 'number') {
              sqs = calculated.score;
            }
          } catch (calcErr) {
            this.logger.warn(`Failed on-demand SQS calculation for repository ${repo.id}: ${calcErr}`);
          }
        }

        const latestCoverage = await this.prisma.coverageReport.findFirst({
          where: { repositoryId: repo.id },
          orderBy: { createdAt: 'desc' },
          select: { coveragePercentage: true },
        });

        return {
          id: repo.id,
          name: repo.name,
          fullName: repo.fullName,
          sqs: Number(sqs.toFixed(1)),
          coverage: Number((latestCoverage?.coveragePercentage || 0).toFixed(1)),
          commits: repo._count.commits,
          commitCount: repo._count.commits,
        };
      }),
    );

    return repoScores.sort((a, b) => b.sqs - a.sqs).slice(0, limit);
  }

  /**
   * Get bottom repositories (needing attention)
   */
  async getBottomRepositories(organizationId: string, limit: number = 5) {
    const topRepos = await this.getTopRepositories(organizationId, 50);
    return topRepos
      .filter((r) => r.sqs > 0 || r.commits > 0)
      .sort((a, b) => a.sqs - b.sqs)
      .slice(0, limit);
  }

  /**
   * Get top developers by DQS
   */
  async getTopDevelopers(organizationId: string, limit: number = 5) {
    // Get organization members
    const members = await this.prisma.organizationMember.findMany({
      where: { organizationId },
      include: {
        user: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
      },
      take: 50,
    });

    const devScores = await Promise.all(
      members.map(async (member) => {
        let latestScore = await this.prisma.dQSScore.findFirst({
          where: { developerId: member.userId },
          orderBy: { calculatedAt: 'desc' },
          select: { score: true },
        });

        // Auto-evaluate developer DQS if not yet persisted
        if (!latestScore) {
          try {
            const calculated = await this.scoresService.calculateDQS(
              member.userId,
              organizationId,
            );
            if (calculated && calculated.score !== null) {
              latestScore = { score: calculated.score };
            }
          } catch (error) {
            this.logger.warn(`Failed to auto-evaluate DQS for developer ${member.userId}: ${error}`);
          }
        }

        const commitCount = await this.prisma.commit.count({
          where: { developerId: member.userId },
        });

        const teamMember = await this.prisma.teamMembership.findFirst({
          where: { userId: member.userId, leftAt: null },
          include: { team: { select: { name: true } } },
        });

        return {
          id: member.user.id,
          name: member.user.name,
          email: member.user.email,
          avatarUrl: member.user.avatarUrl,
          dqs: Number((latestScore?.score || 0).toFixed(1)),
          commits: commitCount,
          commitCount,
          teamName: teamMember?.team?.name || null,
        };
      }),
    );

    return devScores
      .sort((a, b) => {
        if (b.dqs !== a.dqs) {
          return b.dqs - a.dqs;
        }
        return b.commits - a.commits;
      })
      .slice(0, limit);
  }

  /**
   * Get top teams by average DQS
   */
  async getTopTeams(organizationId: string, limit: number = 5) {
    const teams = await this.prisma.team.findMany({
      where: { organizationId, isActive: true },
      include: {
        memberships: {
          where: { leftAt: null },
          select: { userId: true },
        },
      },
    });

    const teamScores = await Promise.all(
      teams.map(async (team) => {
        const memberIds = team.memberships.map((m) => m.userId);

        if (memberIds.length === 0) {
          return {
            id: team.id,
            name: team.name,
            avgDqs: 0,
            memberCount: 0,
          };
        }

        const memberScores = await Promise.all(
          memberIds.map(async (developerId) => {
            return this.prisma.dQSScore.findFirst({
              where: { developerId },
              orderBy: { calculatedAt: 'desc' },
              select: { score: true },
            });
          })
        );
        const scores = memberScores.filter((s) => s !== null);

        const avgDqs =
          scores.length > 0
            ? scores.reduce((sum, s) => sum + (s.score || 0), 0) / scores.length
            : 0;

        return {
          id: team.id,
          name: team.name,
          avgDqs: Number(avgDqs.toFixed(1)),
          memberCount: team.memberships.length,
        };
      }),
    );

    return teamScores.sort((a, b) => b.avgDqs - a.avgDqs).slice(0, limit);
  }

  /**
   * Get recent activity
   */
  async getRecentActivity(organizationId: string, limit: number = 10) {
    const recentCommits = await this.prisma.commit.findMany({
      where: { repository: { organizationId } },
      orderBy: { committedAt: 'desc' },
      take: limit,
      include: {
        developer: { select: { id: true, name: true, avatarUrl: true } },
        repository: { select: { id: true, name: true } },
      },
    });

    return recentCommits.map((c) => ({
      id: c.id,
      type: 'commit',
      message: c.message,
      author: c.developer?.name || c.authorName,
      authorAvatar: c.developer?.avatarUrl,
      repository: c.repository.name,
      classification: c.classification,
      timestamp: c.committedAt,
    }));
  }

  /**
   * Get alerts/notifications
   */
  async getAlerts(organizationId: string) {
    // Get open alerts
    const alerts = await this.prisma.alert.findMany({
      where: {
        organizationId,
        status: { in: ['OPEN', 'ACKNOWLEDGED'] },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    // Get projects with low SQS
    const projects = await this.prisma.project.findMany({
      where: { organizationId, isActive: true },
      select: { id: true, name: true },
    });

    const lowScoreProjects: Array<{ id: string; name: string; score: number; calculatedAt: Date }> =
      [];

    for (const project of projects) {
      const latestScore = await this.prisma.sQSScore.findFirst({
        where: { projectId: project.id },
        orderBy: { calculatedAt: 'desc' },
        select: { id: true, score: true, calculatedAt: true },
      });

      if (latestScore && latestScore.score < 50) {
        lowScoreProjects.push({
          id: latestScore.id,
          name: project.name,
          score: latestScore.score,
          calculatedAt: latestScore.calculatedAt,
        });
      }
    }

    const result = [
      ...alerts.map((a) => ({
        id: a.id,
        type: 'alert' as const,
        severity:
          a.severity === 'CRITICAL' || a.severity === 'HIGH'
            ? ('high' as const)
            : ('warning' as const),
        title: `${a.type}: ${a.severity}`,
        description: a.message,
        timestamp: a.createdAt,
      })),
      ...lowScoreProjects.slice(0, 5).map((s) => ({
        id: s.id,
        type: 'low_score' as const,
        severity: 'warning' as const,
        title: `Low SQS: ${s.name}`,
        description: `Score: ${s.score.toFixed(1)}`,
        timestamp: s.calculatedAt,
      })),
    ];

    return result
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 10);
  }
}
