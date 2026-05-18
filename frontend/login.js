import { setAccountId, getAccountId } from './utils.js';

function init() {
  if (getAccountId()) {
    window.location.href = '/';
    return;
  }

  const createBtn = document.getElementById('create-account-btn');
  const joinBtn = document.getElementById('join-account-btn');
  const accountInput = document.getElementById('account-id-input');

  createBtn?.addEventListener('click', () => {
    const newId = crypto.randomUUID();
    setAccountId(newId);
    window.location.href = '/';
  });

  joinBtn?.addEventListener('click', () => {
    const accountId = accountInput.value.trim();
    if (!accountId) {
      accountInput.focus();
      return;
    }
    setAccountId(accountId);
    window.location.href = '/';
  });

  accountInput?.addEventListener('keypress', e => {
    if (e.key === 'Enter') {
      const accountId = accountInput.value.trim();
      if (accountId) {
        setAccountId(accountId);
        window.location.href = '/';
      }
    }
  });
}

document.addEventListener('DOMContentLoaded', init);