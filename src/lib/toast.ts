/**
 * Wrapper centralizado em torno do Sonner (#61).
 * Forma garantir consistência de duração, ícone e cores em todo o app.
 */
import { toast as sonner } from "sonner";

export const toast = {
  success(message: string, description?: string) {
    sonner.success(message, { description, duration: 3500 });
  },
  error(message: string, description?: string) {
    sonner.error(message, { description, duration: 5000 });
  },
  info(message: string, description?: string) {
    sonner.info(message, { description, duration: 3500 });
  },
  warning(message: string, description?: string) {
    sonner.warning(message, { description, duration: 4000 });
  },
  loading(message: string) {
    return sonner.loading(message);
  },
  dismiss(id?: string | number) {
    sonner.dismiss(id);
  },
  promise<T>(
    promise: Promise<T>,
    msgs: { loading: string; success: string | ((data: T) => string); error: string | ((err: any) => string) },
  ) {
    return sonner.promise(promise, msgs);
  },
};

export type ToastApi = typeof toast;
