(function () {
  const apiUrl = window.APP_CONFIG?.appsScriptUrl;
  const tokenKey = 'minjun-blog-session';
  const userKey = 'minjun-blog-user';

  function isConfigured() { return apiUrl?.startsWith('https://script.google.com/macros/s/'); }
  function getStoredUser() {
    try { return JSON.parse(localStorage.getItem(userKey) || 'null'); }
    catch (_) { localStorage.removeItem(userKey); return null; }
  }
  function clearSession() { localStorage.removeItem(tokenKey); localStorage.removeItem(userKey); }
  async function request(action, payload = {}) {
    if (!isConfigured()) throw new Error('Apps Script 배포 주소를 먼저 설정해 주세요.');
    const separator = apiUrl.includes('?') ? '&' : '?';
    const url = `${apiUrl}${separator}_request=${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch(url, {
        method: 'POST', redirect: 'follow', cache: 'no-store', signal: controller.signal,
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action, ...payload })
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const result = JSON.parse(await response.text());
      if (!result.ok) throw new Error(result.message || '요청을 처리하지 못했습니다.');
      return result;
    } catch (error) {
      if (error.name === 'AbortError') throw new Error('서버 응답이 늦습니다. 잠시 후 다시 시도해 주세요.');
      if (error instanceof SyntaxError || /^HTTP \d+$/.test(error.message)) throw new Error('Google 서버 응답을 불러오지 못했습니다.');
      throw error;
    } finally { clearTimeout(timeout); }
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
      if (values.passwordConfirm && values.password !== values.passwordConfirm) { setMessage(form, '비밀번호가 서로 일치하지 않습니다.', true); return; }
      button.disabled = true; button.textContent = '처리 중…'; setMessage(form, '', false);
      try {
        const result = await request(form.dataset.authForm, values);
        localStorage.setItem(tokenKey, result.token);
        localStorage.setItem(userKey, JSON.stringify(result.user));
        const next = new URLSearchParams(location.search).get('next');
        location.href = form.dataset.authForm === 'login' && next && /^(?:write|profile)\.html(?:\?.*)?$/.test(next) ? next : 'index.html';
      } catch (error) { setMessage(form, error.message, true); }
      finally { button.disabled = false; button.textContent = form.dataset.authForm === 'signup' ? '가입하기 →' : '로그인 →'; }
    });
  });

  const user = getStoredUser();
  const profilePage = document.querySelector('[data-profile-page]');
  if (!profilePage) return;
  if (!user || !localStorage.getItem(tokenKey)) { clearSession(); location.replace('login.html'); return; }
  function renderProfile(profile) {
    document.querySelectorAll('[data-profile-field="name"]').forEach((element) => { element.textContent = profile.name; });
    document.querySelectorAll('[data-profile-field="email"]').forEach((element) => { element.textContent = profile.email; });
  }
  renderProfile(user);
  if (isConfigured()) request('me', { token: localStorage.getItem(tokenKey) })
    .then((result) => { localStorage.setItem(userKey, JSON.stringify(result.user)); renderProfile(result.user); })
    .catch((error) => {
      if (/세션|로그인|만료/.test(error.message)) { clearSession(); location.replace('login.html?expired=1'); }
    });
})();
