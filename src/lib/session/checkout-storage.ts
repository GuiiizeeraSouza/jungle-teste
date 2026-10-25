/**
 * Contexto do checkout persistido por usuário (sessionStorage):
 * - rascunho do formulário, para retomar após expiração de sessão/refresh;
 * - tentativa de pedido em andamento (chave de idempotência + conteúdo),
 *   para que reenvios após timeout/refresh recuperem o MESMO pedido.
 */

export interface CheckoutAttempt {
  idempotencyKey: string;
  /** Conteúdo enviado — se mudar, uma nova chave é gerada. */
  fingerprint: string;
  createdAt: string;
}

const draftKey = (userId: string) => `kurio.checkout.${userId}.draft`;
const attemptKey = (userId: string) => `kurio.checkout.${userId}.attempt`;

function read<T>(key: string): T | null {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown) {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* indisponível */
  }
}

function remove(key: string) {
  try {
    sessionStorage.removeItem(key);
  } catch {
    /* indisponível */
  }
}

export const checkoutStorage = {
  readDraft: <T>(userId: string) => read<T>(draftKey(userId)),
  writeDraft: (userId: string, draft: unknown) => write(draftKey(userId), draft),
  clearDraft: (userId: string) => remove(draftKey(userId)),

  readAttempt: (userId: string) => read<CheckoutAttempt>(attemptKey(userId)),
  /** Reaproveita a chave se o conteúdo for o mesmo; caso contrário gera outra. */
  attemptFor(userId: string, fingerprint: string): CheckoutAttempt {
    const current = read<CheckoutAttempt>(attemptKey(userId));
    if (current && current.fingerprint === fingerprint) return current;
    const attempt: CheckoutAttempt = {
      idempotencyKey: crypto.randomUUID(),
      fingerprint,
      createdAt: new Date().toISOString(),
    };
    write(attemptKey(userId), attempt);
    return attempt;
  },
  clearAttempt: (userId: string) => remove(attemptKey(userId)),
};

export function clearCheckoutStorage(userId: string) {
  checkoutStorage.clearDraft(userId);
  checkoutStorage.clearAttempt(userId);
}
