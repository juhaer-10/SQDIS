import { api } from './api';
import type {
  DashboardStats,
  SqsTrendPoint,
  CommitTrendPoint,
  TopRepository,
  TopDeveloper,
  TopTeam,
  RecentActivity,
  DashboardAlert,
} from '@/types';

export const dashboardService = {
  /**
   * Get organization-wide dashboard statistics
   */
  async getStats(): Promise<DashboardStats> {
    const response = await api.get<DashboardStats>('/dashboard/stats');
    return response.data;
  },

  /**
   * Get SQS trend over time
   */
  async getSQSTrend(days?: number): Promise<SqsTrendPoint[]> {
    const response = await api.get<SqsTrendPoint[]>('/dashboard/sqs-trend', {
      params: { days },
    });
    return response.data;
  },

  /**
   * Get commit activity trend
   */
  async getCommitTrend(days?: number): Promise<CommitTrendPoint[]> {
    const response = await api.get<CommitTrendPoint[]>('/dashboard/commit-trend', {
      params: { days },
    });
    return response.data;
  },

  /**
   * Get top repositories by SQS
   */
  async getTopRepositories(limit?: number): Promise<TopRepository[]> {
    const response = await api.get<TopRepository[]>('/dashboard/top-repositories', {
      params: { limit },
    });
    return response.data;
  },

  /**
   * Get bottom repositories needing attention
   */
  async getBottomRepositories(limit?: number): Promise<TopRepository[]> {
    const response = await api.get<TopRepository[]>('/dashboard/bottom-repositories', {
      params: { limit },
    });
    return response.data;
  },

  /**
   * Get top developers by DQS
   */
  async getTopDevelopers(limit?: number): Promise<TopDeveloper[]> {
    const response = await api.get<TopDeveloper[]>('/dashboard/top-developers', {
      params: { limit },
    });
    return response.data;
  },

  /**
   * Get top teams by average DQS
   */
  async getTopTeams(limit?: number): Promise<TopTeam[]> {
    const response = await api.get<TopTeam[]>('/dashboard/top-teams', {
      params: { limit },
    });
    return response.data;
  },

  /**
   * Get recent engineering activity
   */
  async getRecentActivity(limit?: number, type?: string): Promise<RecentActivity[]> {
    const response = await api.get<RecentActivity[]>('/dashboard/recent-activity', {
      params: { limit, type },
    });
    return response.data;
  },

  /**
   * Get open organization alerts
   */
  async getAlerts(): Promise<DashboardAlert[]> {
    const response = await api.get<DashboardAlert[]>('/dashboard/alerts');
    return response.data;
  },
};

export default dashboardService;