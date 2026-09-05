export type AppUpdateStatus =
  | 'idle'
  | 'checking'
  | 'downloading'
  | 'ready'
  | 'applying'
  | 'no-update'
  | 'error'
  | 'unsupported';

export type AppUpdateState = {
  status: AppUpdateStatus;
  error?: string;
  progress?: number;
  info: {
    appVersion: string;
    channel: string | null;
    runtimeVersion: string | null;
    updateId: string | null;
    embedded: boolean;
    emergencyLaunch: boolean;
  };
};
