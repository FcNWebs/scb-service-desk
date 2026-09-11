const STORAGE_KEY = 'bankITUsers';
const TICKET_STORAGE_KEY = 'bankITTickets';
async function apiRequest(url, options = {}) {
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || 'Request failed.');
  return data;
}

function showNotification(message, type = 'success') {
  const notification = document.createElement('div');
  notification.className = `app-notification ${type}`;
  notification.setAttribute('role', 'status');
  notification.innerHTML = `
    <span class="notification-icon">${type === 'success' ? '&#10003;' : '!'}</span>
    <span class="notification-message">${message}</span>
    <button class="notification-close" type="button" aria-label="Close notification">&times;</button>
  `;

  document.body.appendChild(notification);
  requestAnimationFrame(() => notification.classList.add('visible'));

  const removeNotification = () => {
    notification.classList.remove('visible');
    setTimeout(() => notification.remove(), 220);
  };

  notification.querySelector('.notification-close').addEventListener('click', removeNotification);
  setTimeout(removeNotification, 4500);
}

const defaultUsers = {
  employee: {
    username: 'employee',
    email: 'employee@bankit.com',
    password: 'employee123',
    role: 'Employee',
    displayName: 'Employee User'
  },
  admin: {
    username: 'admin',
    email: 'admin@bankit.com',
    password: 'admin123',
    role: 'Admin',
    displayName: 'System Admin'
  },
  itOfficer: {
    username: 'itofficer',
    email: 'itofficer@bankit.com',
    password: 'itofficer123',
    role: 'IT Officer',
    displayName: 'IT Officer'
  }
};

let users = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null') || defaultUsers;

function saveUsers() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(users));
}

function saveTickets() {
  localStorage.setItem(TICKET_STORAGE_KEY, JSON.stringify(tickets));
}

const navButtons = document.querySelectorAll('.nav-item');
const pageSections = document.querySelectorAll('.page-section');

navButtons.forEach((button) => {
  button.addEventListener('click', () => {
    const target = button.dataset.target;

    navButtons.forEach((item) => item.classList.toggle('active', item === button));
    pageSections.forEach((section) => {
      section.classList.toggle('active', section.dataset.section === target);
    });
  });
});

let tickets = [];
const currentRole = sessionStorage.getItem('bankITUserRole') || 'Employee';
const currentUserName = sessionStorage.getItem('bankITUserName') || '';

const statsGrid = document.getElementById('statsGrid');
const ticketTableBody = document.getElementById('ticketTableBody');
const form = document.getElementById('ticketForm');
const searchInput = document.getElementById('searchInput');
const filterStatus = document.getElementById('filterStatus');
const roleBadge = document.getElementById('roleBadge');
const newTicketBtn = document.getElementById('newTicketButton');
const formPanel = document.querySelector('.form-panel');
const listPanel = document.querySelector('.list-panel');
const adminOfficerPanel = document.getElementById('adminOfficerPanel');
const officerForm = document.getElementById('officerForm');
const addUserButton = document.getElementById('addUserButton');
const cancelUserButton = document.getElementById('cancelUserButton');
const accountTableBody = document.getElementById('accountTableBody');
const accountCount = document.getElementById('accountCount');
const chatMessages = document.getElementById('chatMessages');
const chatForm = document.getElementById('chatForm');
const chatInput = document.getElementById('chatInput');
const chatTicketSelect = document.getElementById('chatTicketSelect');
const chatLauncher = document.getElementById('chatLauncher');
const chatWidget = document.getElementById('chatWidget');
const chatClose = document.getElementById('chatClose');
const chatsNav = document.getElementById('chatsNav');
const chatsUnreadBadge = document.getElementById('chatsUnreadBadge');
const conversationList = document.getElementById('conversationList');
const conversationCount = document.getElementById('conversationCount');
const staffChatTitle = document.getElementById('staffChatTitle');
const staffChatMessages = document.getElementById('staffChatMessages');
const staffChatForm = document.getElementById('staffChatForm');
const staffChatInput = document.getElementById('staffChatInput');
let selectedConversationId = null;

const priorityClassMap = {
  Low: 'priority-low',
  Medium: 'priority-medium',
  High: 'priority-high',
  Critical: 'priority-critical'
};

const statusClassMap = {
  Open: 'status-open',
  'In Progress': 'status-progress',
  Pending: 'status-pending',
  Resolved: 'status-resolved'
};

function createStatCard(label, value, delta, trend) {
  const card = document.createElement('article');
  card.className = 'stat-card';
  card.innerHTML = `
    <p class="mini-label">${label}</p>
    <div class="value">
      <h3>${value}</h3>
      <span class="delta ${trend}">${delta}</span>
    </div>
  `;
  return card;
}

function renderStats() {
  const visibleTickets = currentRole === 'Employee'
    ? tickets.filter((ticket) => ticket.requester === currentUserName)
    : tickets;
  const openCount = visibleTickets.filter((ticket) => ticket.status !== 'Resolved').length;
  const criticalCount = visibleTickets.filter((ticket) => ticket.priority === 'Critical').length;
  const resolvedCount = visibleTickets.filter((ticket) => ticket.status === 'Resolved').length;
  const pendingCount = visibleTickets.filter((ticket) => ticket.status === 'Pending').length;

  statsGrid.innerHTML = '';
  statsGrid.append(
    createStatCard('Open tickets', openCount, `${openCount} active`, 'up'),
    createStatCard('Critical', criticalCount, `${criticalCount} total`, 'down'),
    createStatCard('Resolved', resolvedCount, `${resolvedCount} total`, 'up'),
    createStatCard('Pending SLA', pendingCount, `${pendingCount} pending`, 'down')
  );
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function renderAccounts(usersList) {
  if (!accountTableBody || !accountCount) return;

  accountCount.textContent = `${usersList.length} account${usersList.length === 1 ? '' : 's'}`;

  if (usersList.length === 0) {
    accountTableBody.innerHTML = '<tr><td colspan="4" class="empty-state">No accounts found.</td></tr>';
    return;
  }

  accountTableBody.innerHTML = usersList.map((user) => {
    const isAdmin = user.role === 'Admin';
    const roleControl = isAdmin
      ? '<span class="badge neutral">Admin</span>'
      : `<select class="account-role-select" data-account-role="${user.id}">
          <option value="Employee" ${user.role === 'Employee' ? 'selected' : ''}>Employee</option>
          <option value="IT Officer" ${user.role === 'IT Officer' ? 'selected' : ''}>IT Officer</option>
        </select>`;
    const deleteControl = isAdmin
      ? '<span class="muted">Protected</span>'
      : `<button class="danger-btn" type="button" data-delete-account="${user.id}">Delete</button>`;

    return `<tr>
      <td>${escapeHtml(user.displayName)}</td>
      <td>${escapeHtml(user.username)}</td>
      <td>${roleControl}</td>
      <td><div class="account-actions">${deleteControl}</div></td>
    </tr>`;
  }).join('');

  accountTableBody.querySelectorAll('[data-account-role]').forEach((select) => {
    select.addEventListener('change', async () => {
      try {
        await apiRequest(`/api/users/${select.dataset.accountRole}`, {
          method: 'PATCH',
          body: JSON.stringify({ currentRole, role: select.value })
        });
        showNotification('Account role updated.');
        await loadAccounts();
      } catch (error) {
        showNotification(error.message, 'error');
        await loadAccounts();
      }
    });
  });

  accountTableBody.querySelectorAll('[data-delete-account]').forEach((button) => {
    button.addEventListener('click', async () => {
      try {
        await apiRequest(`/api/users/${button.dataset.deleteAccount}`, {
          method: 'DELETE',
          body: JSON.stringify({ currentRole })
        });
        showNotification('Account deleted.');
        await loadAccounts();
      } catch (error) {
        showNotification(error.message, 'error');
      }
    });
  });
}

async function loadAccounts() {
  if (currentRole !== 'Admin') return;

  try {
    const result = await apiRequest(`/api/users?currentRole=${encodeURIComponent(currentRole)}`);
    renderAccounts(result.users || []);
  } catch (error) {
    showNotification(error.message, 'error');
  }
}

function getPriorityClass(priority) {
  return priorityClassMap[priority] || 'priority-medium';
}

function getStatusClass(status) {
  return statusClassMap[status] || 'status-open';
}

function formatReceivedDate(createdAt) {
  if (!createdAt) return 'Unknown';

  const receivedDate = new Date(`${createdAt.replace(' ', 'T')}Z`);
  if (Number.isNaN(receivedDate.getTime())) return 'Unknown';

  return receivedDate.toLocaleString([], {
    dateStyle: 'medium',
    timeStyle: 'short'
  });
}

function renderTickets() {
  const searchTerm = searchInput.value.trim().toLowerCase();
  const selectedStatus = filterStatus.value;
  const visibleTickets = currentRole === 'Employee'
    ? tickets.filter((ticket) => ticket.requester === currentUserName)
    : tickets;

  const filtered = visibleTickets.filter((ticket) => {
    const matchesStatus = selectedStatus === 'All' || ticket.status === selectedStatus;
    const matchesSearch =
      ticket.title.toLowerCase().includes(searchTerm) ||
      ticket.branch.toLowerCase().includes(searchTerm) ||
      String(ticket.id).toLowerCase().includes(searchTerm);
    return matchesStatus && matchesSearch;
  });

  if (filtered.length === 0) {
    ticketTableBody.innerHTML = `
      <tr>
        <td colspan="10" class="empty-state">No tickets match the selected filters.</td>
      </tr>
    `;
    return;
  }

  const canManageTickets = currentRole === 'Admin' || currentRole === 'IT Officer';

  ticketTableBody.innerHTML = filtered
    .map(
      (ticket) => `
        <tr>
          <td>TCK-${ticket.id}</td>
          <td>
            <div class="ticket-title">${ticket.title}</div>
            <small>${ticket.department}</small>
          </td>
          <td>${ticket.requester}</td>
          <td>${ticket.branch}</td>
          <td>${escapeHtml(ticket.category || 'General')}</td>
          <td class="ticket-details-cell">${escapeHtml(ticket.details)}</td>
          <td>${escapeHtml(formatReceivedDate(ticket.createdAt))}</td>
          <td><span class="priority-pill ${getPriorityClass(ticket.priority)}">${ticket.priority}</span></td>
          <td><span class="status-pill ${getStatusClass(ticket.status)}">${ticket.status}</span></td>
          <td>${canManageTickets
            ? `<select class="ticket-status-select" data-ticket-status="${ticket.id}">
                <option value="Open" ${ticket.status === 'Open' ? 'selected' : ''}>Open</option>
                <option value="In Progress" ${ticket.status === 'In Progress' ? 'selected' : ''}>In Progress</option>
                <option value="Pending" ${ticket.status === 'Pending' ? 'selected' : ''}>Pending</option>
                <option value="Resolved" ${ticket.status === 'Resolved' ? 'selected' : ''}>Resolved</option>
              </select>`
            : `<button class="action-btn" type="button" data-follow-up="${ticket.id}">Follow up</button>`}</td>
        </tr>
      `
    )
    .join('');

  ticketTableBody.querySelectorAll('[data-ticket-status]').forEach((select) => {
    select.addEventListener('change', async () => {
      const selected = tickets.find((ticket) => String(ticket.id) === select.dataset.ticketStatus);
      if (!selected) return;
      try {
        await apiRequest(`/api/incidents/${selected.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ currentRole, status: select.value })
        });
        showNotification('Ticket status updated.');
        await loadTickets();
      } catch (error) {
        showNotification(error.message, 'error');
      }
    });
  });

  ticketTableBody.querySelectorAll('[data-follow-up]').forEach((button) => {
    button.addEventListener('click', () => {
      const selected = tickets.find((ticket) => String(ticket.id) === button.dataset.followUp);
      if (!selected || !formPanel) return;

      document.getElementById('title').value = `Follow-up: ${selected.title}`;
      document.getElementById('branch').value = selected.branch;
      document.getElementById('department').value = selected.department;
      document.getElementById('priority').value = selected.priority;
      document.getElementById('category').value = selected.category;
      document.getElementById('details').value = `Follow-up for ticket TCK-${selected.id}: `;
      formPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
      document.getElementById('details').focus({ preventScroll: true });
      showNotification('Follow-up form prepared. Add the latest details and submit.');
    });
  });
}

async function loadTickets() {
  try {
    const result = await apiRequest('/api/incidents');
    tickets = result.incidents || [];
    populateChatTickets();
    renderStats();
    renderTickets();
  } catch (error) {
    console.error('Failed to load incidents:', error);
    tickets = [];
    renderStats();
    renderTickets();
  }
}

function renderMessages(container, messages) {
  if (!container) return;

  if (messages.length === 0) {
    container.innerHTML = '<p class="empty-state">No messages yet. Start the conversation.</p>';
    return;
  }

  container.innerHTML = messages.map((item) => {
    const ownMessage = item.senderName === currentUserName;
    const timestamp = new Date(`${item.createdAt.replace(' ', 'T')}Z`).toLocaleString();
    return `<article class="chat-message${ownMessage ? ' own-message' : ''}">
      <div class="chat-message-meta">
        <strong>${escapeHtml(item.senderName)}</strong>
        <span>${escapeHtml(item.senderRole)} · ${escapeHtml(timestamp)}</span>
      </div>
      <p class="chat-message-text">${escapeHtml(item.message)}</p>
    </article>`;
  }).join('');

  container.scrollTop = container.scrollHeight;
}

function renderChatMessages(messages) {
  renderMessages(chatMessages, messages);
}

function populateChatTickets() {
  if (!chatTicketSelect || currentRole !== 'Employee') return;

  const activeTickets = tickets.filter((ticket) =>
    ticket.requester === currentUserName && ticket.status !== 'Resolved'
  );
  const selectedValue = chatTicketSelect.value;
  chatTicketSelect.innerHTML = '<option value="" disabled>Choose a ticket to discuss</option>';
  activeTickets.forEach((ticket) => {
    const option = document.createElement('option');
    option.value = ticket.id;
    option.textContent = `TCK-${ticket.id} - ${ticket.title}`;
    chatTicketSelect.appendChild(option);
  });

  if (activeTickets.some((ticket) => String(ticket.id) === selectedValue)) {
    chatTicketSelect.value = selectedValue;
  } else {
    chatTicketSelect.value = '';
    renderChatMessages([]);
  }
}

async function loadChatMessages() {
  if (!chatMessages) return;

  const ticketId = chatTicketSelect?.value;
  const conversationId = ticketId
    ? sessionStorage.getItem(`bankITConversationId_${ticketId}`)
    : null;
  if (!conversationId) {
    renderChatMessages([]);
    return;
  }

  try {
    const result = await apiRequest(`/api/conversations/${conversationId}/messages?currentRole=${encodeURIComponent(currentRole)}`);
    renderChatMessages(result.messages || []);
  } catch (error) {
    chatMessages.innerHTML = `<p class="empty-state">${escapeHtml(error.message)}</p>`;
  }
}

function renderConversations(conversations) {
  if (!conversationList || !conversationCount) return;

  conversationCount.textContent = conversations.length;
  const unreadCount = conversations.reduce((total, conversation) => total + Number(conversation.unreadCount || 0), 0);
  if (chatsUnreadBadge) {
    chatsUnreadBadge.textContent = unreadCount > 99 ? '99+' : unreadCount;
    chatsUnreadBadge.hidden = unreadCount === 0;
  }
  if (conversations.length === 0) {
    conversationList.innerHTML = '<p class="empty-state">No employee conversations yet.</p>';
    return;
  }

  conversationList.innerHTML = conversations.map((conversation) => `
    <button class="conversation-item${conversation.id === selectedConversationId ? ' active' : ''}" type="button" data-conversation-id="${conversation.id}">
      <strong>${escapeHtml(conversation.employeeName)}</strong>
      <span>TCK-${escapeHtml(conversation.ticketId || 'N/A')} · ${escapeHtml(conversation.subject)}</span>
      <small>${escapeHtml(conversation.lastMessage || 'No messages')}</small>
    </button>
  `).join('');

  conversationList.querySelectorAll('[data-conversation-id]').forEach((button) => {
    button.addEventListener('click', () => {
      selectedConversationId = Number(button.dataset.conversationId);
      loadStaffConversation();
      renderConversations(conversations);
    });
  });
}

async function loadConversations() {
  if (!conversationList || !['Admin', 'IT Officer'].includes(currentRole)) return;

  try {
    const result = await apiRequest(`/api/conversations?currentRole=${encodeURIComponent(currentRole)}&userName=${encodeURIComponent(currentUserName)}`);
    renderConversations(result.conversations || []);
  } catch (error) {
    conversationList.innerHTML = `<p class="empty-state">${escapeHtml(error.message)}</p>`;
  }
}

async function loadStaffConversation() {
  if (!selectedConversationId || !staffChatMessages) return;

  try {
    const result = await apiRequest(`/api/conversations/${selectedConversationId}/messages?currentRole=${encodeURIComponent(currentRole)}`);
    renderMessages(staffChatMessages, result.messages || []);
    staffChatForm.hidden = false;
    await apiRequest(`/api/conversations/${selectedConversationId}/read`, {
      method: 'POST',
      body: JSON.stringify({ currentRole, userName: currentUserName })
    });
    await loadConversations();
  } catch (error) {
    staffChatMessages.innerHTML = `<p class="empty-state">${escapeHtml(error.message)}</p>`;
  }
}

if (document.body.dataset.page === 'dashboard') {
  const isLoggedIn = sessionStorage.getItem('bankITLoggedIn') === 'true';

  if (!isLoggedIn) {
    window.location.href = 'login.html';
  }

  if (roleBadge) {
    roleBadge.textContent = currentRole;
  }

  if (chatsNav && !['Admin', 'IT Officer'].includes(currentRole)) {
    chatsNav.style.display = 'none';
  } else if (chatsNav) {
    chatsNav.style.display = 'block';
  }

  const ticketSectionTitle = document.getElementById('ticketSectionTitle');
  if (ticketSectionTitle && currentRole !== 'Employee') {
    ticketSectionTitle.textContent = 'All submitted tickets';
  }

  const requesterInput = document.getElementById('requester');
  if (requesterInput && currentRole === 'Employee') {
    requesterInput.value = currentUserName;
  }

  if (newTicketBtn && currentRole !== 'Employee') {
    newTicketBtn.style.display = 'none';
  }

  if (adminOfficerPanel) {
    adminOfficerPanel.style.display = currentRole === 'Admin' ? 'block' : 'none';
  }

  if (formPanel && currentRole !== 'Employee') {
    formPanel.style.display = 'none';
  }

  if (newTicketBtn && formPanel && currentRole === 'Employee') {
    newTicketBtn.addEventListener('click', () => {
      formPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
      document.getElementById('title').focus({ preventScroll: true });
    });
  }

  if (listPanel && currentRole !== 'Employee') {
    listPanel.style.display = 'block';
  }

  if (currentRole === 'Admin') {
    loadAccounts();
  }

  if (['Admin', 'IT Officer'].includes(currentRole)) {
    chatLauncher.style.display = 'none';
    loadConversations();
    setInterval(loadConversations, 5000);
  }

  if (chatMessages) {
    loadChatMessages();
    setInterval(loadChatMessages, 5000);
  }

  if (chatLauncher && chatWidget) {
    chatLauncher.addEventListener('click', () => {
      chatWidget.hidden = false;
      chatLauncher.setAttribute('aria-expanded', 'true');
      chatInput.focus();
      loadChatMessages();
    });
  }

  if (chatTicketSelect) {
    chatTicketSelect.addEventListener('change', () => {
      loadChatMessages();
      chatInput.focus();
    });
  }

  if (chatClose && chatWidget && chatLauncher) {
    chatClose.addEventListener('click', () => {
      chatWidget.hidden = true;
      chatLauncher.setAttribute('aria-expanded', 'false');
      chatLauncher.focus();
    });
  }

  if (chatForm) {
    chatForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const message = chatInput.value.trim();
      if (!message) return;

      try {
        const ticketId = chatTicketSelect?.value;
        if (!ticketId) {
          showNotification('Select an active ticket before starting a chat.', 'error');
          return;
        }

        const conversationStorageKey = `bankITConversationId_${ticketId}`;
        const conversationId = sessionStorage.getItem(conversationStorageKey);
        if (conversationId) {
          await apiRequest(`/api/conversations/${conversationId}/messages`, {
            method: 'POST',
            body: JSON.stringify({ currentRole, senderName: currentUserName, message })
          });
        } else {
          const result = await apiRequest('/api/conversations', {
            method: 'POST',
            body: JSON.stringify({
              currentRole,
              employeeName: currentUserName,
              ticketId,
              subject: message.slice(0, 60),
              message
            })
          });
          sessionStorage.setItem(conversationStorageKey, result.conversationId);
        }
        chatInput.value = '';
        await loadChatMessages();
      } catch (error) {
        showNotification(error.message, 'error');
      }
    });
  }

  if (staffChatForm) {
    staffChatForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const message = staffChatInput.value.trim();
      if (!message || !selectedConversationId) return;

      try {
        await apiRequest(`/api/conversations/${selectedConversationId}/messages`, {
          method: 'POST',
          body: JSON.stringify({ currentRole, senderName: currentUserName, message })
        });
        staffChatInput.value = '';
        await loadStaffConversation();
        await loadConversations();
      } catch (error) {
        showNotification(error.message, 'error');
      }
    });
  }

  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      sessionStorage.removeItem('bankITLoggedIn');
      sessionStorage.removeItem('bankITUserRole');
      sessionStorage.removeItem('bankITUserName');
      window.location.href = 'login.html';
    });
  }

  if (officerForm && currentRole === 'Admin') {
    addUserButton.addEventListener('click', () => {
      addUserButton.style.display = 'none';
      officerForm.style.display = 'block';
    });

    cancelUserButton.addEventListener('click', () => {
      officerForm.reset();
      officerForm.style.display = 'none';
      addUserButton.style.display = 'inline-flex';
    });

    officerForm.addEventListener('submit', async (event) => {
      event.preventDefault();

      const userRole = document.getElementById('userRole').value;
      const officerName = document.getElementById('officerName').value.trim();
      const officerEmail = document.getElementById('officerEmail').value.trim();
      const officerUsername = document.getElementById('officerUsername').value.trim();
      const officerPassword = document.getElementById('officerPassword').value.trim();

      if (!officerName || !officerEmail || !officerUsername || !officerPassword) {
        showNotification('Please fill in all account fields.', 'error');
        return;
      }

      try {
        await apiRequest('/api/users', {
          method: 'POST',
          body: JSON.stringify({
            currentRole,
            role: userRole,
            fullName: officerName,
            email: officerEmail,
            username: officerUsername,
            password: officerPassword
          })
        });
        officerForm.reset();
        officerForm.style.display = 'none';
        addUserButton.style.display = 'inline-flex';
        showNotification(`${userRole} account created successfully.`);
        await loadAccounts();
      } catch (error) {
        showNotification(error.message, 'error');
      }
    });
  }

  if (form) {
    form.addEventListener('submit', async (event) => {
      if (currentRole !== 'Employee') {
        event.preventDefault();
        showNotification('Only employees can log incidents.', 'error');
        return;
      }

      event.preventDefault();

      const title = document.getElementById('title').value.trim();
      const branch = document.getElementById('branch').value.trim();
      const department = document.getElementById('department').value;
      const priority = document.getElementById('priority').value;
      const category = document.getElementById('category').value;
      const requester = document.getElementById('requester').value.trim();
      const details = document.getElementById('details').value.trim();

      try {
        await apiRequest('/api/incidents', {
          method: 'POST',
          body: JSON.stringify({ title, branch, department, priority, requester, category, details })
        });
        form.reset();
        requesterInput.value = currentUserName;
        showNotification('Ticket submitted successfully. The SCB IT team has received your report.');
        await loadTickets();
      } catch (error) {
        showNotification(error.message, 'error');
      }
    });
  }

  if (searchInput) {
    searchInput.addEventListener('input', renderTickets);
  }

  if (filterStatus) {
    filterStatus.addEventListener('change', renderTickets);
  }

  loadTickets();
}

const loginForm = document.getElementById('loginForm');
const resolvedMetric = document.getElementById('resolvedMetric');
const openMetric = document.getElementById('openMetric');
const totalMetric = document.getElementById('totalMetric');

if (resolvedMetric && openMetric && totalMetric) {
  apiRequest('/api/summary')
    .then(({ summary }) => {
      resolvedMetric.textContent = summary.resolved;
      openMetric.textContent = summary.open;
      totalMetric.textContent = summary.total;
    })
    .catch(() => {
      resolvedMetric.textContent = '-';
      openMetric.textContent = '-';
      totalMetric.textContent = '-';
    });
}

if (loginForm) {
  loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const email = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value.trim();

    if (!email || !password) {
      showNotification('Please enter both your username and password.', 'error');
      return;
    }

    try {
      const result = await apiRequest('/api/login', {
        method: 'POST',
        body: JSON.stringify({ emailOrUsername: email, password })
      });
      sessionStorage.setItem('bankITLoggedIn', 'true');
      sessionStorage.setItem('bankITUserRole', result.user.role);
      sessionStorage.setItem('bankITUserName', result.user.displayName);
      window.location.href = 'index.html';
    } catch (error) {
      showNotification(error.message, 'error');
    }
  });
}
