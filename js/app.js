(() => {
  const { POSTS, ABOUT, PRODUCTS, CONTACT } = window.BLOG_DATA;

  /* ── Helpers ── */
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

  // Safe markdown parser — never crashes even if CDN is blocked
  function parseMarkdown(md) {
    if (typeof marked !== 'undefined' && marked.parse) {
      try { return marked.parse(md.trim()); } catch (e) {}
    }
    // Plain-text fallback
    return md.trim()
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .split('\n\n').map(block => {
        const trimmed = block.trim();
        if (/^#{2,3}\s/.test(trimmed)) return `<h3 style="margin-top:1.5em">${trimmed.replace(/^#{2,3}\s*/, '')}</h3>`;
        if (/^#{1}\s/.test(trimmed)) return `<h2 style="margin-top:1.5em">${trimmed.replace(/^#\s*/, '')}</h2>`;
        if (trimmed.startsWith('---')) return '<hr>';
        if (trimmed.startsWith('- ') || trimmed.startsWith('* '))
          return '<ul>' + trimmed.split('\n').map(l => `<li>${l.replace(/^[-*]\s*/, '')}</li>`).join('') + '</ul>';
        if (/^\d+\.\s/.test(trimmed))
          return '<ol>' + trimmed.split('\n').map(l => `<li>${l.replace(/^\d+\.\s*/, '')}</li>`).join('') + '</ol>';
        return '<p>' + trimmed.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>') + '</p>';
      }).join('\n');
  }

  function formatDate(str) {
    const d = new Date(str);
    return d.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' });
  }

  function getAllTags() {
    const map = {};
    POSTS.forEach(p => p.tags.forEach(t => { map[t] = (map[t] || 0) + 1; }));
    return map;
  }

  function renderTag(tag, active = false) {
    return `<span class="tag${active ? ' active' : ''}" data-tag="${tag}">${tag}</span>`;
  }

  function renderPostCard(post) {
    return `
      <article class="post-card" data-id="${post.id}">
        <div class="post-card-meta">
          <span class="post-date">${formatDate(post.date)}</span>
          ${post.tags.map(t => renderTag(t)).join('')}
        </div>
        <h3>${post.title}</h3>
        <p>${post.summary}</p>
        <div class="post-card-footer">
          <span class="read-time">阅读约 ${post.readTime}</span>
          <span style="font-size:12px;color:var(--primary)">阅读全文 →</span>
        </div>
      </article>`;
  }

  /* ── Router ── */
  let currentPage = 'home';

  // 有效页面列表（已移除 articles 导航项，但保留内部跳转）
  const VALID_PAGES = ['home', 'articles', 'tags', 'about', 'service', 'article'];

  function showPage(name) {
    $$('.page').forEach(p => p.classList.remove('active'));
    const el = $(`#page-${name}`);
    if (el) el.classList.add('active');
    $$('nav a').forEach(a => {
      a.classList.toggle('active', a.dataset.page === name);
    });
    currentPage = name;
    window.scrollTo(0, 0);
  }

  function navigate(name) {
    history.pushState({ page: name }, '', `#${name}`);
    showPage(name);
  }

  window.addEventListener('popstate', e => {
    const page = (e.state && e.state.page) || 'home';
    showPage(page);
  });

  /* ── Home page ── */
  function renderHome() {
    const recent = POSTS.slice(0, 4);
    const tags = getAllTags();
    const topTags = Object.keys(tags).filter(t => t !== '晨星计划').slice(0, 6);

    $('#hero-tags').innerHTML = topTags.map(t => renderTag(t)).join('');
    $('#recent-posts').innerHTML = recent.length
      ? recent.map(renderPostCard).join('')
      : `<div class="empty" style="padding:2rem 0;font-size:14px;color:var(--text-muted)">暂无文章，敬请期待…</div>`;

    // Products → clickable cards
    $('#home-products').innerHTML = PRODUCTS.map(p => `
      <div class="product-card" data-service="${p.id}">
        <h4>${p.name}</h4>
        <p>${p.desc}</p>
        <span style="font-size:12px;color:var(--primary);margin-top:0.5rem;display:inline-block">了解详情 →</span>
      </div>
    `).join('');

    // Bind product card clicks via event delegation
    $('#home-products').addEventListener('click', (e) => {
      const card = e.target.closest('.product-card');
      if (card) {
        e.preventDefault();
        openService(card.dataset.service);
      }
    });

    // 联系我 — 全新排版，含个人介绍
    const bioShort = ABOUT.bio.split('\n\n')[0]; // 取第一段作为简介
    $('#home-contact').innerHTML = `
      <div class="contact-section">

        <!-- 个人介绍卡 -->
        <div class="contact-bio-block">
          <div class="contact-bio-avatar">${ABOUT.name[0]}</div>
          <div class="contact-bio-text">
            <div class="contact-bio-name">${ABOUT.name}</div>
            <div class="contact-bio-role">${ABOUT.title}</div>
            <div class="contact-bio-desc">${bioShort}</div>
          </div>
        </div>

        <!-- 联系方式卡片 -->
        <div class="contact-cards">
          <div class="contact-card">
            <span class="contact-card-icon wechat-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M8.691 2.188C3.891 2.188 0 5.476 0 9.53c0 2.212 1.17 4.203 3.002 5.55a.59.59 0 0 1 .213.665l-.39 1.48c-.019.07-.048.141-.048.213 0 .163.13.295.29.295a.326.326 0 0 0 .167-.054l1.903-1.114a.864.864 0 0 1 .717-.098 10.16 10.16 0 0 0 2.837.403c.276 0 .543-.027.811-.05-.857-2.578.157-4.972 1.932-6.446 1.703-1.415 3.882-1.98 5.853-1.838-.576-3.583-4.196-6.348-8.596-6.348zM5.785 5.991c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178A1.17 1.17 0 0 1 4.623 7.17c0-.651.52-1.18 1.162-1.18zm5.813 0c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178 1.17 1.17 0 0 1-1.162-1.178c0-.651.52-1.18 1.162-1.18zm5.34 2.867c-1.797-.052-3.746.512-5.28 1.786-1.72 1.428-2.687 3.72-1.78 6.22.942 2.453 3.666 4.229 6.884 4.229.826 0 1.622-.12 2.361-.336a.722.722 0 0 1 .598.082l1.584.926a.272.272 0 0 0 .14.047c.134 0 .24-.111.24-.247 0-.06-.023-.12-.038-.177l-.327-1.233a.582.582 0 0 1-.023-.156.49.49 0 0 1 .201-.398C23.024 18.48 24 16.82 24 14.98c0-3.21-2.931-5.952-7.062-6.122zm-2.18 2.769c.535 0 .969.44.969.982a.976.976 0 0 1-.969.983.976.976 0 0 1-.969-.983c0-.542.434-.982.97-.982zm4.844 0c.535 0 .969.44.969.982a.976.976 0 0 1-.969.983.976.976 0 0 1-.969-.983c0-.542.434-.982.97-.982z"/></svg>
            </span>
            <div class="contact-card-body">
              <span class="contact-card-label">微信</span>
              <span class="contact-card-value">${CONTACT.wechat}</span>
            </div>
          </div>
          <div class="contact-card">
            <span class="contact-card-icon oa-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 12h8M12 8l4 4-4 4"/></svg>
            </span>
            <div class="contact-card-body">
              <span class="contact-card-label">公众号</span>
              <span class="contact-card-value">${CONTACT.official_account}</span>
            </div>
          </div>
        </div>

        <!-- 备注提示 -->
        <div class="contact-note">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          ${CONTACT.intro}
        </div>

      </div>
    `;

    // Tag click on hero → tags page
    $$('.tag', $('#hero-tags')).forEach(el => {
      el.addEventListener('click', () => {
        navigate('tags');
        filterByTag(el.dataset.tag);
      });
    });
    if (recent.length) bindPostCards($('#recent-posts'));
  }

  /* ── Articles page ── */
  let activeFilter = null;

  function renderArticles(filterTag = null) {
    activeFilter = filterTag;
    const filtered = filterTag ? POSTS.filter(p => p.tags.includes(filterTag)) : POSTS;
    const container = $('#all-posts');

    if (filtered.length === 0) {
      container.innerHTML = `<div class="empty">没有找到相关文章</div>`;
      return;
    }
    container.innerHTML = filtered.map(renderPostCard).join('');
    bindPostCards(container);

    // Update filter chips
    const chips = $$('.filter-chip');
    chips.forEach(c => c.classList.toggle('active', c.dataset.tag === filterTag));
    if (!filterTag) chips.forEach(c => c.classList.remove('active'));
  }

  function bindPostCards(container) {
    $$('.post-card', container).forEach(card => {
      card.addEventListener('click', e => {
        const tagEl = e.target.closest('.tag');
        if (tagEl) {
          e.stopPropagation();
          navigate('articles');
          renderArticles(tagEl.dataset.tag);
          return;
        }
        openArticle(parseInt(card.dataset.id));
      });
    });
    $$('.tag', container).forEach(tag => {
      tag.addEventListener('click', e => {
        e.stopPropagation();
        navigate('articles');
        renderArticles(tag.dataset.tag);
      });
    });
  }

  function buildFilterChips() {
    const tags = getAllTags();
    const sorted = Object.entries(tags).sort((a, b) => b[1] - a[1]);
    const wrap = $('#filter-chips');
    wrap.innerHTML = `<span class="tag" data-tag="">全部</span>` +
      sorted.map(([t]) => `<span class="filter-chip tag" data-tag="${t}">${t}</span>`).join('');
    $$('.tag', wrap).forEach(el => {
      el.addEventListener('click', () => renderArticles(el.dataset.tag || null));
    });
  }

  // Search
  function bindSearch() {
    const inp = $('#search-input');
    if (!inp) return;
    inp.addEventListener('input', () => {
      const q = inp.value.trim().toLowerCase();
      if (!q) { renderArticles(activeFilter); return; }
      const filtered = POSTS.filter(p =>
        p.title.toLowerCase().includes(q) ||
        p.summary.toLowerCase().includes(q) ||
        p.tags.some(t => t.toLowerCase().includes(q))
      );
      const container = $('#all-posts');
      container.innerHTML = filtered.length
        ? filtered.map(renderPostCard).join('')
        : `<div class="empty">没有找到"${q}"相关的文章</div>`;
      if (filtered.length) bindPostCards(container);
    });
  }

  /* ── Article detail ── */
  function openArticle(id) {
    const post = POSTS.find(p => p.id === id);
    if (!post) return;

    const html = parseMarkdown(post.content);
    const toc = buildTOC(post.content);

    $('#article-container').innerHTML = `
      <button class="back-btn" id="btn-back">← 返回</button>
      <div class="article-header">
        <h1 class="article-title">${post.title}</h1>
        <div class="article-meta">
          <span>${formatDate(post.date)}</span>
          <span>·</span>
          <span>阅读约 ${post.readTime}</span>
          <span>·</span>
          ${post.tags.map(t => renderTag(t)).join('')}
        </div>
      </div>
      ${toc ? `<div class="toc"><div class="toc-title">目录</div>${toc}</div>` : ''}
      <div class="md-content">${html}</div>
    `;

    $('#btn-back').addEventListener('click', () => history.back());
    $$('.tag', $('#article-container')).forEach(el => {
      el.addEventListener('click', () => {
        navigate('articles');
        renderArticles(el.dataset.tag);
      });
    });

    navigate('article');
  }

  /* ── Service detail ── */
  function openService(id) {
    const service = PRODUCTS.find(p => p.id === id);
    if (!service) return;

    const html = parseMarkdown(service.content);

    $('#service-container').innerHTML = `
      <button class="back-btn" id="btn-service-back">← 返回首页</button>
      <div class="article-header">
        <h1 class="article-title">${service.name}</h1>
      </div>
      <div class="md-content">${html}</div>
    `;

    $('#btn-service-back').addEventListener('click', () => navigate('home'));

    navigate('service');
  }

  function buildTOC(md) {
    const headings = [];
    const lines = md.split('\n');
    lines.forEach(line => {
      const m = line.match(/^(#{2,3})\s+(.+)/);
      if (m) {
        const level = m[1].length;
        const text = m[2].trim();
        const anchor = text.replace(/\s+/g, '-').toLowerCase();
        headings.push({ level, text, anchor });
      }
    });
    if (headings.length < 2) return '';
    const items = headings.map(h => {
      const indent = h.level === 3 ? 'style="margin-left:1em"' : '';
      return `<li ${indent}><a href="#${h.anchor}">${h.text}</a></li>`;
    }).join('');
    return `<ul>${items}</ul>`;
  }

  /* ── Tags page ── */
  function renderTagsPage() {
    const tags = getAllTags();
    const sorted = Object.entries(tags).sort((a, b) => b[1] - a[1]);
    if (sorted.length === 0) {
      $('#tags-grid').innerHTML = `<div class="empty" style="grid-column:1/-1;padding:2rem 0">暂无标签</div>`;
      return;
    }
    $('#tags-grid').innerHTML = sorted.map(([tag, count]) => `
      <div class="tag-card" data-tag="${tag}">
        <div class="tag-card-name"># ${tag}</div>
        <div class="tag-card-count">${count} 篇文章</div>
      </div>`).join('');
    $$('.tag-card').forEach(card => {
      card.addEventListener('click', () => {
        navigate('articles');
        renderArticles(card.dataset.tag);
      });
    });
  }

  function filterByTag(tag) {
    renderArticles(tag);
  }

  /* ── About page ── */
  function renderAbout() {
    const tags = getAllTags();

    $('#about-avatar').textContent = ABOUT.name[0];
    $('#about-name').textContent = ABOUT.name;
    $('#about-title').textContent = ABOUT.title;
    $('#about-post-count').textContent = POSTS.length;
    $('#about-tag-count').textContent = Object.keys(tags).length;

    $('#about-bio').innerHTML = ABOUT.bio.split('\n\n').map(p => `<p>${p}</p>`).join('');
    $('#about-skills').innerHTML = ABOUT.skills.map(s => `<span class="skill-tag">${s}</span>`).join('');
    if (ABOUT.social && ABOUT.social.wechat) {
      $('#about-wechat-id').textContent = ABOUT.social.wechat;
    }
  }

  /* ── Nav & Init ── */
  function init() {
    // Nav clicks
    $$('nav a').forEach(a => {
      a.addEventListener('click', e => {
        e.preventDefault();
        navigate(a.dataset.page);
      });
    });

    // Home CTA
    $('#btn-all-posts').addEventListener('click', () => navigate('articles'));

    renderHome();
    buildFilterChips();
    renderArticles();
    bindSearch();
    renderTagsPage();
    renderAbout();

    // Initial route
    const hash = location.hash.replace('#', '') || 'home';
    showPage(VALID_PAGES.includes(hash) ? hash : 'home');
  }

  document.addEventListener('DOMContentLoaded', init);
})();
