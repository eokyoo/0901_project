(function () {
  const tokenKey = 'minjun-blog-session';
  const userKey = 'minjun-blog-user';
  const postsCacheKey = 'minjun-blog-posts-v2';
  const requestTimeout = 12000;
  const form = document.querySelector('[data-draft-form]');

  function readJson(key) {
    try { return JSON.parse(localStorage.getItem(key) || 'null'); }
    catch (_) { localStorage.removeItem(key); return null; }
  }
  function writeJson(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) {} }
  const token = () => localStorage.getItem(tokenKey);
  const user = () => readJson(userKey);
  const postCacheKey = (id) => `minjun-blog-post-v2:${id}`;
  const myPostsCacheKey = () => `minjun-blog-my-posts-v2:${user()?.id || 'guest'}`;

  async function request(action, payload = {}) {
    const apiUrl = window.APP_CONFIG?.appsScriptUrl;
    if (!apiUrl) throw new Error('게시글 API 주소가 설정되지 않았습니다.');
    const separator = apiUrl.includes('?') ? '&' : '?';
    const url = `${apiUrl}${separator}_request=${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), requestTimeout);
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

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);
  }
  function formatDate(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '' : new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
  }
  const postSummary = (post) => post.summary || String(post.content || '').replace(/\s+/g, ' ').slice(0, 110);
  function showState(container, message, isError = false) { container.innerHTML = `<p class="crud-state${isError ? ' error' : ''}">${escapeHtml(message)}</p>`; }
  function cachePosts(posts) {
    writeJson(postsCacheKey, { savedAt: Date.now(), posts });
    posts.forEach((post) => writeJson(postCacheKey(post.id), { savedAt: Date.now(), post }));
  }
  function invalidatePostCaches() { localStorage.removeItem(postsCacheKey); localStorage.removeItem(myPostsCacheKey()); }

  function renderHome(posts, featured, recentList) {
    if (!posts.length) { showState(featured, '아직 발행된 글이 없습니다.'); showState(recentList, '첫 번째 이야기를 기다리고 있습니다.'); return; }
    const first = posts[0];
    const url = `post.html?id=${encodeURIComponent(first.id)}`;
    featured.innerHTML = `<a class="featured-art" href="${url}" aria-label="${escapeHtml(first.title)} 읽기"><span class="art-grid"></span><span class="art-type">LATEST<br>STORY.</span><span class="art-index">${escapeHtml(first.category)}</span></a><div class="featured-copy"><p class="post-meta"><span>${escapeHtml(first.category)}</span><time>${escapeHtml(formatDate(first.createdAt))}</time><span>${escapeHtml(first.authorName)}</span></p><h3><a href="${url}">${escapeHtml(first.title)}</a></h3><p>${escapeHtml(postSummary(first))}</p><a class="read-link" href="${url}">이어 읽기 →</a></div>`;
    const recent = posts.slice(1, 4);
    if (!recent.length) { showState(recentList, '다음 이야기를 기다리고 있습니다.'); return; }
    recentList.innerHTML = recent.map((post, index) => `<article class="post-row"><p class="post-order">${String(index + 1).padStart(2, '0')}</p><div><p class="post-meta"><span>${escapeHtml(post.category)}</span><time>${escapeHtml(formatDate(post.createdAt))}</time></p><h3><a href="post.html?id=${encodeURIComponent(post.id)}">${escapeHtml(post.title)}</a></h3></div><p class="post-excerpt">${escapeHtml(postSummary(post))}</p><a class="round-arrow" href="post.html?id=${encodeURIComponent(post.id)}" aria-label="${escapeHtml(post.title)} 읽기">→</a></article>`).join('');
  }
  async function initHomePosts() {
    const featured = document.querySelector('.featured-post');
    const recentList = document.querySelector('.home-hero ~ .section .post-list');
    if (!featured || !recentList) return;
    const cached = readJson(postsCacheKey)?.posts;
    if (cached) renderHome(cached, featured, recentList);
    try { const { posts } = await request('listPosts'); cachePosts(posts); renderHome(posts, featured, recentList); }
    catch (error) { if (!cached) { showState(featured, error.message, true); showState(recentList, error.message, true); } }
  }

  function renderPostList(posts, container) {
    const heading = document.querySelector('.page-hero .kicker');
    if (heading) heading.textContent = `Archive · ${posts.length} stories`;
    if (!posts.length) { showState(container, '아직 발행된 글이 없습니다. 첫 글을 작성해 보세요.'); return; }
    container.innerHTML = posts.map((post, index) => `<article class="post-row" data-crud-post data-category="${escapeHtml(post.category)}"><p class="post-order">${String(index + 1).padStart(2, '0')}</p><div><p class="post-meta"><span>${escapeHtml(post.category)}</span><time>${escapeHtml(formatDate(post.createdAt))}</time></p><h3><a href="post.html?id=${encodeURIComponent(post.id)}">${escapeHtml(post.title)}</a></h3></div><p class="post-excerpt">${escapeHtml(postSummary(post))}</p><a class="round-arrow" href="post.html?id=${encodeURIComponent(post.id)}" aria-label="${escapeHtml(post.title)} 읽기">→</a></article>`).join('');
    setupDynamicFilters(container);
  }
  async function initPostList() {
    const container = document.querySelector('.archive .post-list');
    if (!container) return;
    const cached = readJson(postsCacheKey)?.posts;
    if (cached) renderPostList(cached, container);
    try { const { posts } = await request('listPosts'); cachePosts(posts); renderPostList(posts, container); }
    catch (error) { if (!cached) showState(container, error.message, true); }
  }
  function setupDynamicFilters(container) {
    const search = document.querySelector('[data-post-search]');
    const filters = document.querySelectorAll('[data-filter]');
    const empty = document.querySelector('[data-empty-state]');
    if (container.dataset.filtersReady) return;
    container.dataset.filtersReady = 'true';
    let category = '전체';
    const apply = () => {
      const query = search?.value.trim().toLowerCase() || '';
      let count = 0;
      container.querySelectorAll('[data-crud-post]').forEach((post) => {
        const visible = (category === '전체' || post.dataset.category === category) && post.textContent.toLowerCase().includes(query);
        post.hidden = !visible; if (visible) count += 1;
      });
      empty?.classList.toggle('show', count === 0);
    };
    filters.forEach((button) => button.addEventListener('click', () => { category = button.dataset.filter; filters.forEach((item) => item.classList.toggle('active', item === button)); apply(); }));
    search?.addEventListener('input', apply);
  }

  function renderPost(post, main) {
    document.title = `${post.title} — 민준의 노트`;
    const paragraphs = String(post.content || '').split(/\n{2,}/).map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, '<br>')}</p>`).join('');
    main.innerHTML = `<article><header class="article-header article-shell"><p class="post-meta"><span>${escapeHtml(post.category)}</span><time>${escapeHtml(formatDate(post.createdAt))}</time></p><h1>${escapeHtml(post.title)}</h1>${post.summary ? `<p class="article-lead">${escapeHtml(post.summary)}</p>` : ''}<div class="article-author"><div class="author-avatar" aria-hidden="true">${escapeHtml(post.authorName.slice(0, 1))}</div><p><strong>${escapeHtml(post.authorName)}</strong><br><span>민준의 노트 작성자</span></p></div></header><div class="article-cover" aria-hidden="true"><span class="cover-type">NEW<br>STORY.</span><span class="cover-code">${escapeHtml(post.category)}</span></div><div class="article-body">${paragraphs}<nav class="article-nav"><a href="posts.html">← 목록으로</a></nav></div></article>`;
  }
  async function initPostDetail() {
    if (!location.pathname.endsWith('post.html')) return;
    const id = new URLSearchParams(location.search).get('id');
    const main = document.querySelector('body > main');
    if (!main) return;
    if (!id) { showState(main, '글 주소가 올바르지 않습니다.', true); return; }
    const cached = readJson(postCacheKey(id));
    if (cached?.post) renderPost(cached.post, main);
    try { const { post } = await request('getPost', { id }); writeJson(postCacheKey(id), { savedAt: Date.now(), post }); renderPost(post, main); }
    catch (error) { if (!cached?.post) showState(main, error.message, true); }
  }

  function setupDraft(id) {
    const key = `minjun-blog-draft-v2:${id || 'new'}:${user()?.id || 'guest'}`;
    const status = document.querySelector('.draft-status');
    let active = true;
    const restore = () => {
      const draft = readJson(key);
      if (!draft?.values) return false;
      Object.entries(draft.values).forEach(([name, value]) => { if (form.elements[name]) form.elements[name].value = value; });
      if (status) status.textContent = '브라우저에 임시 저장된 내용을 복원했습니다.';
      return true;
    };
    const save = () => {
      if (!active) return;
      writeJson(key, { savedAt: Date.now(), values: Object.fromEntries(new FormData(form).entries()) });
      if (status) status.textContent = `자동 저장됨 · ${new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}`;
    };
    let timer;
    form.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(save, 500); });
    document.querySelector('[data-save-draft]')?.addEventListener('click', () => { save(); window.showBlogToast?.('임시 저장했습니다.'); });
    addEventListener('pagehide', save);
    return { restore, clear() { active = false; localStorage.removeItem(key); } };
  }

  async function initWriteForm() {
    if (!form) return;
    if (!token() || !user()) { location.replace(`login.html?next=${encodeURIComponent('write.html' + location.search)}`); return; }
    const id = new URLSearchParams(location.search).get('id');
    const draft = setupDraft(id);
    const title = document.querySelector('.write-sidebar h1');
    const submit = form.querySelector('button:not([type="button"])');
    const message = document.createElement('p');
    message.className = 'auth-message'; message.setAttribute('role', 'status'); form.querySelector('.write-actions').before(message);
    if (id) {
      if (title) title.innerHTML = '글<br>수정';
      if (submit) submit.textContent = '수정 완료 →';
      const localPost = readJson(postCacheKey(id))?.post;
      if (localPost) ['title', 'category', 'summary', 'content'].forEach((name) => { form.elements[name].value = localPost[name] || ''; });
      const restored = draft.restore();
      try {
        const { post } = await request('getPost', { id });
        writeJson(postCacheKey(id), { savedAt: Date.now(), post });
        if (!restored) ['title', 'category', 'summary', 'content'].forEach((name) => { form.elements[name].value = post[name] || ''; });
      } catch (error) { if (!localPost && !restored) { message.textContent = error.message; message.classList.add('error'); submit.disabled = true; } }
    } else draft.restore();
    form.addEventListener('submit', async (event) => {
      event.preventDefault(); if (!form.reportValidity()) return;
      const values = Object.fromEntries(new FormData(form).entries());
      const originalText = submit.textContent;
      submit.disabled = true; submit.textContent = '저장 중…'; message.textContent = ''; message.classList.remove('error');
      try {
        const result = await request(id ? 'updatePost' : 'createPost', { ...values, id, token: token() });
        draft.clear(); invalidatePostCaches(); writeJson(postCacheKey(result.post.id), { savedAt: Date.now(), post: result.post });
        location.href = `post.html?id=${encodeURIComponent(result.post.id)}`;
      } catch (error) { message.textContent = error.message; message.classList.add('error'); submit.disabled = false; submit.textContent = originalText; }
    });
  }

  function renderMyPosts(posts, container) {
    if (!posts.length) { showState(container, '작성한 글이 없습니다. 첫 글을 작성해 보세요.'); return; }
    container.innerHTML = posts.map((post) => `<article class="my-post-row" data-post-id="${escapeHtml(post.id)}"><div><p class="post-meta"><span>${escapeHtml(post.category)}</span><time>수정 ${escapeHtml(formatDate(post.updatedAt))}</time></p><h3><a href="post.html?id=${encodeURIComponent(post.id)}">${escapeHtml(post.title)}</a></h3><p>${escapeHtml(postSummary(post))}</p></div><div class="my-post-actions"><a class="secondary-button" href="write.html?id=${encodeURIComponent(post.id)}">수정</a><button class="danger-button" type="button" data-delete-post>삭제</button></div></article>`).join('');
  }
  async function loadMyPosts() {
    const container = document.querySelector('[data-my-posts]');
    if (!container || !token()) return;
    const cached = readJson(myPostsCacheKey())?.posts;
    if (cached) renderMyPosts(cached, container);
    try { const { posts } = await request('myPosts', { token: token() }); writeJson(myPostsCacheKey(), { savedAt: Date.now(), posts }); renderMyPosts(posts, container); }
    catch (error) { if (!cached) showState(container, error.message, true); }
  }
  document.querySelector('[data-my-posts]')?.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-delete-post]');
    if (!button) return;
    const row = button.closest('[data-post-id]');
    if (!confirm('이 글을 삭제할까요? 삭제한 글은 복구할 수 없습니다.')) return;
    button.disabled = true;
    try {
      await request('deletePost', { id: row.dataset.postId, token: token() });
      localStorage.removeItem(postCacheKey(row.dataset.postId)); invalidatePostCaches(); row.remove();
      const container = document.querySelector('[data-my-posts]');
      if (!container.querySelector('[data-post-id]')) showState(container, '작성한 글이 없습니다. 첫 글을 작성해 보세요.');
    } catch (error) { alert(error.message); button.disabled = false; }
  });

  initHomePosts(); initPostList(); initPostDetail(); initWriteForm(); loadMyPosts();
})();
