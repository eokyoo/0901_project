(function () {
  const apiUrl = window.APP_CONFIG?.appsScriptUrl;
  const tokenKey = 'minjun-blog-session';

  function isConfigured() {
    return apiUrl && apiUrl.startsWith('https://script.google.com/macros/s/');
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
        localStorage.setItem('minjun-blog-user', JSON.stringify(result.user));
        location.href = 'index.html';
      } catch (error) {
        setMessage(form, error.message, true);
      } finally {
        button.disabled = false;
        button.textContent = form.dataset.authForm === 'signup' ? '가입하기 →' : '로그인 →';
      }
    });
  });

  const user = JSON.parse(localStorage.getItem('minjun-blog-user') || 'null');
  document.querySelectorAll('[data-auth-link]').forEach((link) => {
    if (!user) return;
    link.textContent = `${user.name} · 로그아웃`;
    link.href = '#logout';
    link.addEventListener('click', async (event) => {
      event.preventDefault();
      const token = localStorage.getItem(tokenKey);
      try { if (token && isConfigured()) await request('logout', { token }); } catch (_) {}
      localStorage.removeItem(tokenKey);
      localStorage.removeItem('minjun-blog-user');
      location.href = 'index.html';
    });
  });
})();
