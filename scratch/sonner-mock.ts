export const toastCalls: Array<{ message: string; opts: any }> = [];
export const toast = Object.assign(
  (message: string, opts?: any) => { toastCalls.push({ message, opts }); },
  {
    warning: (message: string, opts?: any) => { toastCalls.push({ message, opts }); },
    error: (message: string, opts?: any) => { toastCalls.push({ message, opts }); },
    success: (message: string, opts?: any) => { toastCalls.push({ message, opts }); },
    info: (message: string, opts?: any) => { toastCalls.push({ message, opts }); },
  },
);
