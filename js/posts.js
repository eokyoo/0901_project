(function () {
  const tokenKey = 'minjun-blog-session';
  const userKey = 'minjun-blog-user';
  const form = document.querySelector('[data-draft-form]');
  if (form) window.blogCrudEnabled = true;

  function token() {
    return localStorage.getItem(tokenKey);
  }

  function user() {
    try {
      return JSON.parse(localStorage.getItem(userKey) || 'null');
    } catch (_) {
      return null;
    }
  }

  async function ensureConfig() {
    if (window.APP_CONFIG?.appsScriptUrl) return;
    await new Promise((resolve) => {
      const script = document.createElement('script');
      script.src = 'js/config.js';
      script.onload = resolve;
      script.onerror = resolve;
      document.head.append(script);
    });
  }

  async function request(action, payload = {}) {
    await ensureConfig();
    const apiUrl = window.APP_CONFIG?.appsScriptUrl;
    if (!apiUrl) throw new Error('게시물 API 주소가 설정되지 않았습니다.');
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

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>'"]/g, (character) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    })[character]);
  }

  function formatDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
  }

  function postSummary(post) {
    return post.summary || post.content.replace(/\s+/g, ' ').slice(0, 110);
  }

  function showState(container, message, isError = false) {
    container.innerHTML = `<p class="crud-state${isError ? ' error' : ''}">${escapeHtml(message)}</p>`;
  }

  async function initHomePosts() {
    const featured = document.querySelector('.featured-post');
    const recentList = document.querySelector('.home-hero ~ .section .post-list');
    if (!featured || !recentList || !(location.pathname.endsWith('index.html') || location.pathname.endsWith('/'))) return;
    showState(featured, '최신 글을 불러오는 중입니다…');
    showState(recentList, '최근 글을 불러오는 중입니다…');
    try {
      const { posts } = await request('listPosts');
      if (!posts.length) {
        showState(featured, '아직 발행된 글이 없습니다.');
        showState(recentList, '첫 번째 이야기를 기다리고 있습니다.');
        return;
      }
      const first = posts[0];
      const firstUrl = `post.html?id=${encodeURIComponent(first.id)}`;
      featured.innerHTML = `
        <a class="featured-art" href="${firstUrl}" aria-label="${escapeHtml(first.title)} 읽기">
          <span class="art-grid"></span><span class="art-type">LATEST<br>STORY.</span><span class="art-index">${escapeHtml(first.category)}</span>
        </a>
        <div class="featured-copy">
          <p class="post-meta"><span>${escapeHtml(first.category)}</span><time>${escapeHtml(formatDate(first.createdAt))}</time><span>${escapeHtml(first.authorName)}</span></p>
          <h3><a href="${firstUrl}">${escapeHtml(first.title)}</a></h3>
          <p>${escapeHtml(postSummary(first))}</p>
          <a class="read-link" href="${firstUrl}">이어 읽기 ↗</a>
        </div>`;
      const recent = posts.slice(1, 4);
      if (!recent.length) {
        showState(recentList, '다음 이야기를 기다리고 있습니다.');
        return;
      }
      recentList.innerHTML = recent.map((post, index) => {
        const url = `post.html?id=${encodeURIComponent(post.id)}`;
        return `<article class="post-row">
          <p class="post-order">${String(index + 1).padStart(2, '0')}</p>
          <div><p class="post-meta"><span>${escapeHtml(post.category)}</span><time>${escapeHtml(formatDate(post.createdAt))}</time></p><h3><a href="${url}">${escapeHtml(post.title)}</a></h3></div>
          <p class="post-excerpt">${escapeHtml(postSummary(post))}</p>
          <a class="round-arrow" href="${url}" aria-label="${escapeHtml(post.title)} 읽기">↗</a>
        </article>`;
      }).join('');
    } catch (error) {
      showState(featured, error.message, true);
      showState(recentList, error.message, true);
    }
  }

  async function initPostList() {
    const container = document.querySelector('.archive .post-list');
    if (!container) return;
    showState(container, '글을 불러오는 중입니다…');
    try {
      const { posts } = await request('listPosts');
      const heading = document.querySelector('.page-hero .kicker');
      if (heading) heading.textContent = `Archive · ${posts.length} stories`;
      if (!posts.length) {
        showState(container, '아직 발행된 글이 없습니다. 첫 글을 작성해 보세요.');
        return;
      }
      container.innerHTML = posts.map((post, index) => `
        <article class="post-row" data-crud-post data-category="${escapeHtml(post.category)}">
          <p class="post-order">${String(index + 1).padStart(2, '0')}</p>
          <div>
            <p class="post-meta"><span>${escapeHtml(post.category)}</span><time>${escapeHtml(formatDate(post.createdAt))}</time></p>
            <h3><a href="post.html?id=${encodeURIComponent(post.id)}">${escapeHtml(post.title)}</a></h3>
          </div>
          <p class="post-excerpt">${escapeHtml(postSummary(post))}</p>
          <a class="round-arrow" href="post.html?id=${encodeURIComponent(post.id)}" aria-label="${escapeHtml(post.title)} 읽기">↗</a>
        </article>`).join('');
      setupDynamicFilters(container);
    } catch (error) {
      showState(container, error.message, true);
    }
  }

  function setupDynamicFilters(container) {
    const search = document.querySelector('[data-post-search]');
    const filters = document.querySelectorAll('[data-filter]');
    const empty = document.querySelector('[data-empty-state]');
    let category = '전체';
    const apply = () => {
      const query = search?.value.trim().toLowerCase() || '';
      let visibleCount = 0;
      container.querySelectorAll('[data-crud-post]').forEach((post) => {
        const visible = (category === '전체' || post.dataset.category === category) && post.textContent.toLowerCase().includes(query);
        post.hidden = !visible;
        if (visible) visibleCount += 1;
      });
      empty?.classList.toggle('show', visibleCount === 0);
    };
    filters.forEach((button) => button.addEventListener('click', () => {
      category = button.dataset.filter;
      filters.forEach((item) => item.classList.toggle('active', item === button));
      apply();
    }));
    search?.addEventListener('input', apply);
  }

  async function initPostDetail() {
    const id = new URLSearchParams(location.search).get('id');
    const main = document.querySelector('body > main');
    if (!id || !main || !location.pathname.endsWith('post.html')) return;
    showState(main, '글을 불러오는 중입니다…');
    try {
      const { post } = await request('getPost', { id });
      document.title = `${post.title} — 민준의 노트`;
      const paragraphs = post.content.split(/\n{2,}/).map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, '<br>')}</p>`).join('');
      main.innerHTML = `<article>
        <header class="article-header article-shell">
          <p class="post-meta"><span>${escapeHtml(post.category)}</span><time>${escapeHtml(formatDate(post.createdAt))}</time></p>
          <h1>${escapeHtml(post.title)}</h1>
          ${post.summary ? `<p class="article-lead">${escapeHtml(post.summary)}</p>` : ''}
          <div class="article-author"><div class="author-avatar" aria-hidden="true">${escapeHtml(post.authorName.slice(0, 1))}</div><p><strong>${escapeHtml(post.authorName)}</strong><br><span>민준의 노트 작성자</span></p></div>
        </header>
        <div class="article-cover" aria-hidden="true"><span class="cover-type">NEW<br>STORY.</span><span class="cover-code">${escapeHtml(post.category)}</span></div>
        <div class="article-body">${paragraphs}<nav class="article-nav"><a href="posts.html">← 목록으로</a></nav></div>
      </article>`;
    } catch (error) {
      showState(main, error.message, true);
    }
  }

  async function initWriteForm() {
    if (!form) return;
    if (!token() || !user()) {
      location.replace(`login.html?next=${encodeURIComponent('write.html' + location.search)}`);
      return;
    }
    const id = new URLSearchParams(location.search).get('id');
    const title = document.querySelector('.write-sidebar h1');
    const submit = form.querySelector('button:not([type="button"])');
    let message = form.querySelector('[data-crud-message]');
    if (!message) {
      message = document.createElement('p');
      message.className = 'auth-message';
      message.dataset.crudMessage = '';
      message.setAttribute('role', 'status');
      form.querySelector('.write-actions').before(message);
    }
    if (id) {
      if (title) title.innerHTML = '글<br>수정';
      if (submit) submit.textContent = '수정 완료 →';
      try {
        const { post } = await request('getPost', { id });
        ['title', 'category', 'summary', 'content'].forEach((name) => {
          if (form.elements[name]) form.elements[name].value = post[name] || '';
        });
      } catch (error) {
        message.textContent = error.message;
        message.classList.add('error');
        if (submit) submit.disabled = true;
      }
    }
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (!form.reportValidity()) return;
      const values = Object.fromEntries(new FormData(form).entries());
      const originalText = submit.textContent;
      submit.disabled = true;
      submit.textContent = '저장 중…';
      message.textContent = '';
      message.classList.remove('error');
      try {
        const result = await request(id ? 'updatePost' : 'createPost', { ...values, id, token: token() });
        localStorage.removeItem('blog-draft');
        location.href = `post.html?id=${encodeURIComponent(result.post.id)}`;
      } catch (error) {
        message.textContent = error.message;
        message.classList.add('error');
        submit.disabled = false;
        submit.textContent = originalText;
      }
    }, true);
  }

  async function loadMyPosts() {
    const container = document.querySelector('[data-my-posts]');
    if (!container) return;
    showState(container, '내 글을 불러오는 중입니다…');
    try {
      const { posts } = await request('myPosts', { token: token() });
      if (!posts.length) {
        showState(container, '작성한 글이 없습니다. 첫 글을 작성해 보세요.');
        return;
      }
      container.innerHTML = posts.map((post) => `
        <article class="my-post-row" data-post-id="${escapeHtml(post.id)}">
          <div>
            <p class="post-meta"><span>${escapeHtml(post.category)}</span><time>수정 ${escapeHtml(formatDate(post.updatedAt))}</time></p>
            <h3><a href="post.html?id=${encodeURIComponent(post.id)}">${escapeHtml(post.title)}</a></h3>
            <p>${escapeHtml(postSummary(post))}</p>
          </div>
          <div class="my-post-actions">
            <a class="secondary-button" href="write.html?id=${encodeURIComponent(post.id)}">수정</a>
            <button class="danger-button" type="button" data-delete-post>삭제</button>
          </div>
        </article>`).join('');
    } catch (error) {
      showState(container, error.message, true);
    }
  }

  document.querySelector('[data-my-posts]')?.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-delete-post]');
    if (!button) return;
    const row = button.closest('[data-post-id]');
    if (!confirm('이 글을 삭제할까요? 삭제한 글은 복구할 수 없습니다.')) return;
    button.disabled = true;
    try {
      await request('deletePost', { id: row.dataset.postId, token: token() });
      row.remove();
      const container = document.querySelector('[data-my-posts]');
      if (!container.querySelector('[data-post-id]')) showState(container, '작성한 글이 없습니다. 첫 글을 작성해 보세요.');
    } catch (error) {
      alert(error.message);
      button.disabled = false;
    }
  });

  initHomePosts();
  initPostList();
  initPostDetail();
  initWriteForm();
  loadMyPosts();
})();
