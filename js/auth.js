(function () {
  const apiUrl = window.APP_CONFIG?.appsScriptUrl;
  const tokenKey = 'minjun-blog-session';
  const userKey = 'minjun-blog-user';

  function isConfigured() {
    return apiUrl && apiUrl.startsWith('https://script.google.com/macros/s/');
  }

  function getStoredUser() {
    try {
      return JSON.parse(localStorage.getItem(userKey) || 'null');
    } catch (_) {
      localStorage.removeItem(userKey);
      return null;
    }
  }

  function clearSession() {
    localStorage.removeItem(tokenKey);
    localStorage.removeItem(userKey);
  }

  async function request(action, payload = {}) {
    if (!isConfigured()) throw new Error('Apps Script 웹 앱 주소를 먼저 설정해 주세요.');
    const response = await fetch(apiUrl, {
      method: 'POST',
      redirect: 'follow',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action, ...payload })
    });
    const result = await response.json();
    if (!result.ok) throw new Error(result.message || '요청을 처리하지 못했습니다.');
    return result;
  }

  function setMessage(form, message, isError) {
    const element = form.querySelector('[data-auth-message]');
    if (!element) return;
    element.textContent = message;
    element.classList.toggle('error', Boolean(isError));
  }

  document.querySelectorAll('[data-auth-form]').forEach((form) => {
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!form.reportValidity()) return;
      const button = form.querySelector('button[type="submit"]');
      const values = Object.fromEntries(new FormData(form).entries());
      if (values.passwordConfirm && values.password !== values.passwordConfirm) {
        setMessage(form, '비밀번호가 서로 일치하지 않습니다.', true);
        return;
      }
      button.disabled = true;
      button.textContent = '처리 중…';
      setMessage(form, '', false);
      try {
        const result = await request(form.dataset.authForm, values);
        localStorage.setItem(tokenKey, result.token);
        localStorage.setItem(userKey, JSON.stringify(result.user));
        location.href = 'index.html';
      } catch (error) {
        setMessage(form, error.message, true);
      } finally {
        button.disabled = false;
        button.textContent = form.dataset.authForm === 'signup' ? '가입하기 →' : '로그인 →';
      }
    });
  });

  const user = getStoredUser();

  const profilePage = document.querySelector('[data-profile-page]');
  if (profilePage) {
    if (!user || !localStorage.getItem(tokenKey)) {
      clearSession();
      location.replace('login.html');
      return;
    }

    document.querySelectorAll('[data-profile-field="name"]').forEach((element) => {
      element.textContent = user.name;
    });
    document.querySelectorAll('[data-profile-field="email"]').forEach((element) => {
      element.textContent = user.email;
    });

    if (isConfigured()) {
      request('me', { token: localStorage.getItem(tokenKey) })
        .then((result) => {
          localStorage.setItem(userKey, JSON.stringify(result.user));
          document.querySelectorAll('[data-profile-field="name"]').forEach((element) => {
            element.textContent = result.user.name;
          });
          document.querySelectorAll('[data-profile-field="email"]').forEach((element) => {
            element.textContent = result.user.email;
          });
        })
        .catch(() => {
          clearSession();
          location.replace('login.html?expired=1');
        });
    }
  }
})();
