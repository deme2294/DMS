/**
 * Utility for resolving English icon names and emojis for Knowledge Base Categories.
 * Supports full English words (e.g. "gmail", "laptop", "printer", "network", "security")
 * as well as direct Unicode emojis.
 */

export interface IconPreset {
  label: string;
  icon: string;
  category: string;
}

export const POPULAR_ICON_PRESETS: IconPreset[] = [
  { label: 'Email / Gmail', icon: '📧', category: 'Communication' },
  { label: 'Mail', icon: '✉️', category: 'Communication' },
  { label: 'Chat / Messaging', icon: '💬', category: 'Communication' },
  { label: 'Phone / Hotline', icon: '📱', category: 'Communication' },
  { label: 'Laptop / PC', icon: '💻', category: 'Hardware & IT' },
  { label: 'Desktop / Server', icon: '🖥️', category: 'Hardware & IT' },
  { label: 'Printer / Scanner', icon: '🖨️', category: 'Hardware & IT' },
  { label: 'Database / Storage', icon: '🗄️', category: 'Hardware & IT' },
  { label: 'Network / Internet', icon: '🌐', category: 'Hardware & IT' },
  { label: 'WiFi / Wireless', icon: '📶', category: 'Hardware & IT' },
  { label: 'Security / Firewall', icon: '🛡️', category: 'Security' },
  { label: 'Lock / Password', icon: '🔒', category: 'Security' },
  { label: 'Key / Access', icon: '🔑', category: 'Security' },
  { label: 'Knowledge / Books', icon: '📚', category: 'Documentation' },
  { label: 'Document / File', icon: '📄', category: 'Documentation' },
  { label: 'Forms / Policies', icon: '📋', category: 'Documentation' },
  { label: 'Folder / Directory', icon: '📁', category: 'Documentation' },
  { label: 'Help / Support', icon: '💡', category: 'Support' },
  { label: 'FAQ / Questions', icon: '❓', category: 'Support' },
  { label: 'Bug / Defect', icon: '🐛', category: 'Support' },
  { label: 'Warning / Alert', icon: '⚠️', category: 'Support' },
  { label: 'Ticket / Incident', icon: '🎫', category: 'Support' },
  { label: 'Tools / Fix', icon: '🛠️', category: 'Admin' },
  { label: 'Settings / Gear', icon: '⚙️', category: 'Admin' },
  { label: 'User / Profile', icon: '👤', category: 'People' },
  { label: 'Team / Staff', icon: '👥', category: 'People' },
  { label: 'Billing / Payment', icon: '💳', category: 'Finance' },
  { label: 'Building / Office', icon: '🏢', category: 'Facilities' },
  { label: 'Home / Remote', icon: '🏠', category: 'Facilities' },
  { label: 'Calendar / Schedule', icon: '📅', category: 'Productivity' },
  { label: 'Analytics / Stats', icon: '📊', category: 'Productivity' },
  { label: 'Rocket / Deploy', icon: '🚀', category: 'Productivity' },
];

export const ICON_MAP: Record<string, string> = {
  // Email & Communication
  gmail: '📧',
  googlemail: '📧',
  email: '📧',
  mail: '✉️',
  inbox: '📥',
  outbox: '📤',
  post: '📮',
  envelope: '✉️',
  newsletter: '📰',
  chat: '💬',
  message: '💬',
  messages: '💬',
  comment: '💬',
  sms: '📱',
  call: '📞',
  phone: '📱',
  mobile: '📱',
  telephone: '☎️',
  contact: '📇',
  hotline: '☎️',

  // Hardware & Devices
  laptop: '💻',
  computer: '💻',
  pc: '💻',
  desktop: '🖥️',
  monitor: '🖥️',
  screen: '🖥️',
  macbook: '💻',
  notebook: '💻',
  workstation: '🖥️',
  hardware: '🖥️',
  server: '🖥️',
  datacenter: '🗄️',
  database: '🗄️',
  db: '🗄️',
  sql: '🗄️',
  storage: '💾',
  disk: '💾',
  harddrive: '💾',
  usb: '🔌',
  printer: '🖨️',
  print: '🖨️',
  scanner: '🖨️',
  fax: '📠',
  copier: '🖨️',
  device: '📱',
  devices: '💻',
  tablet: '📱',
  ipad: '📱',
  keyboard: '⌨️',
  mouse: '🖱️',
  cable: '🔌',
  projector: '📽️',

  // Network & Connectivity
  network: '🌐',
  wifi: '📶',
  wireless: '📶',
  internet: '🌐',
  web: '🌐',
  lan: '🔌',
  wan: '🌐',
  router: '📡',
  modem: '📡',
  vpn: '🛡️',
  ip: '🌐',
  dns: '🌐',
  bandwidth: '⚡',
  signal: '📶',
  antenna: '📡',
  bluetooth: '🔷',
  cloud: '☁️',
  online: '🟢',

  // Security & Authentication
  security: '🛡️',
  shield: '🛡️',
  protect: '🛡️',
  protection: '🛡️',
  firewall: '🧱',
  antivirus: '🛡️',
  lock: '🔒',
  locked: '🔒',
  unlock: '🔓',
  key: '🔑',
  keys: '🔑',
  passkey: '🔑',
  password: '🔐',
  passwords: '🔐',
  pin: '🔢',
  token: '🪙',
  auth: '🔐',
  authentication: '🔐',
  login: '🔑',
  logout: '🚪',
  sso: '🔐',
  mfa: '📲',
  '2fa': '📲',
  certificate: '📜',
  ssl: '🔒',
  privacy: '👁️‍🗨️',
  safe: '🛡️',
  vault: '🏦',

  // Knowledge & Documentation
  book: '📚',
  books: '📚',
  knowledge: '📚',
  kb: '📚',
  library: '📚',
  reading: '📖',
  manual: '📖',
  guide: '📖',
  guidelines: '📜',
  handbook: '📕',
  wiki: '📖',
  docs: '📑',
  documentation: '📑',
  article: '📰',
  articles: '📰',
  document: '📄',
  documents: '📄',
  doc: '📄',
  file: '📄',
  files: '📁',
  folder: '📁',
  folders: '📂',
  directory: '📁',
  page: '📄',
  paper: '📝',
  note: '📝',
  notes: '📝',
  memo: '📝',
  report: '📊',
  reports: '📈',
  form: '📋',
  forms: '📋',
  contract: '📜',
  policy: '📋',
  policies: '📋',
  procedure: '📋',
  sop: '📋',

  // Issues, Troubleshooting & Support
  help: '💡',
  support: '🆘',
  service: '🛎️',
  faq: '❓',
  question: '❓',
  questions: '❓',
  info: 'ℹ️',
  information: 'ℹ️',
  tip: '💡',
  tips: '💡',
  idea: '💡',
  solution: '💡',
  troubleshoot: '🔧',
  troubleshooting: '🔧',
  issue: '⚠️',
  issues: '⚠️',
  problem: '⚠️',
  problems: '⚠️',
  bug: '🐛',
  bugs: '🐛',
  error: '❌',
  errors: '❌',
  warning: '⚠️',
  alert: '🚨',
  emergency: '🚨',
  incident: '🚨',
  danger: '⚠️',
  ticket: '🎫',
  tickets: '🎫',
  fix: '🛠️',
  repair: '🛠️',
  maintenance: '🔧',

  // Tools & Administration
  tool: '🛠️',
  tools: '🛠️',
  wrench: '🔧',
  hammer: '🔨',
  gear: '⚙️',
  gears: '⚙️',
  settings: '⚙️',
  config: '⚙️',
  configuration: '⚙️',
  setup: '⚙️',
  preference: '⚙️',
  preferences: '⚙️',
  options: '⚙️',
  admin: '👑',
  administration: '👑',
  manager: '👔',
  management: '👔',
  dashboard: '📊',
  control: '🎛️',
  panel: '🎛️',
  utility: '🧰',
  utilities: '🧰',

  // People & Organization
  user: '👤',
  users: '👥',
  account: '👤',
  accounts: '👥',
  profile: '👤',
  person: '👤',
  people: '👥',
  client: '👤',
  clients: '👥',
  customer: '👤',
  customers: '👥',
  tenant: '🏢',
  tenants: '🏢',
  staff: '👥',
  employee: '👤',
  employees: '👥',
  team: '👥',
  teams: '👥',
  group: '👥',
  department: '🏢',
  hr: '🤝',
  human_resources: '🤝',
  role: '🎖️',
  roles: '🎖️',
  community: '🌐',

  // Development & Software
  code: '👨‍💻',
  coding: '👨‍💻',
  developer: '👨‍💻',
  dev: '👨‍💻',
  software: '💿',
  app: '📱',
  application: '📱',
  api: '🔌',
  git: '🌿',
  github: '🐙',
  terminal: '💻',
  script: '📜',
  webpage: '🌐',
  deploy: '🚀',
  deployment: '🚀',
  release: '🚀',
  install: '💿',
  installation: '💿',
  update: '🔄',
  upgrade: '⬆️',
  version: '🏷️',

  // Finance, Billing & Business
  billing: '💳',
  invoice: '🧾',
  invoices: '🧾',
  payment: '💳',
  payments: '💳',
  card: '💳',
  creditcard: '💳',
  money: '💰',
  cash: '💵',
  dollar: '💲',
  currency: '💱',
  finance: '📈',
  accounting: '🧮',
  subscription: '💳',
  price: '🏷️',
  pricing: '🏷️',
  receipt: '🧾',
  bank: '🏦',
  wallet: '👛',
  tax: '📊',

  // Facilities, Building & Home
  office: '🏢',
  building: '🏢',
  headquarters: '🏢',
  facility: '🏭',
  room: '🚪',
  desk: '🪑',
  house: '🏠',
  home: '🏠',
  apartment: '🏢',
  property: '🏡',
  parking: '🅿️',
  elevator: '🛗',
  door: '🚪',
  keycard: '🪪',
  location: '📍',
  map: '🗺️',
  address: '📍',

  // Time & Productivity
  calendar: '📅',
  schedule: '📅',
  date: '📆',
  time: '⏰',
  clock: '🕒',
  timer: '⏱️',
  stopwatch: '⏱️',
  deadline: '⏳',
  reminder: '🔔',
  bell: '🔔',
  alarm: '⏰',
  task: '☑️',
  tasks: '📋',
  todo: '📝',
  checklist: '✅',
  project: '📁',
  goal: '🎯',
  target: '🎯',
  milestone: '🚩',

  // Media, Audio & Video
  camera: '📷',
  video: '📹',
  meeting: '👥',
  conference: '🎥',
  screenshare: '🖥️',
  audio: '🔊',
  sound: '🔊',
  speaker: '🔊',
  volume: '🔉',
  mute: '🔇',
  mic: '🎙️',
  microphone: '🎙️',
  headphone: '🎧',
  headphones: '🎧',
  headset: '🎧',
  image: '🖼️',
  photo: '🖼️',
  picture: '🖼️',
  media: '🎬',
  music: '🎵',

  // Status & Misc
  success: '✅',
  approved: '✅',
  check: '✅',
  done: '✅',
  complete: '✅',
  cancel: '❌',
  rejected: '❌',
  cross: '❌',
  star: '⭐',
  favorite: '⭐',
  heart: '❤️',
  like: '👍',
  dislike: '👎',
  tag: '🏷️',
  tags: '🏷️',
  label: '🏷️',
  badge: '🎖️',
  trophy: '🏆',
  award: '🥇',
  gift: '🎁',
  rocket: '🚀',
  speed: '⚡',
  lightning: '⚡',
  sync: '🔄',
  refresh: '🔄',
  archive: '📦',
  box: '📦',
  package: '📦',
  trash: '🗑️',
  delete: '🗑️',
  remove: '🗑️',
  search: '🔍',
  find: '🔍',
  filter: '🔍',
  health: '❤️',
  medical: '🩺',
  hospital: '🏥',
  link: '🔗',
  url: '🔗',
  share: '🔗',
  download: '📥',
  upload: '📤',
  backup: '💾',
  restore: '♻️',
  chart: '📊',
  graph: '📈',
  analytics: '📊',
  stats: '📈',
};

/**
 * Checks if a string contains any emoji character
 */
export function isEmoji(str?: string | null): boolean {
  if (!str) return false;
  const emojiRegex = /(\p{Extended_Pictographic}|\p{Emoji_Presentation})/u;
  return emojiRegex.test(str);
}

/**
 * Resolves an icon string (which could be an English keyword like 'gmail', 'laptop', 'wifi',
 * or already an emoji like '💻', or even null/undefined) to a clean visual emoji icon.
 */
export function resolveCategoryIcon(iconOrName?: string | null, fallback = '📁'): string {
  if (!iconOrName) return fallback;
  const trimmed = iconOrName.trim();
  if (!trimmed) return fallback;

  // 1. If it already contains an emoji, return it
  if (isEmoji(trimmed)) {
    return trimmed;
  }

  // 2. Normalize and check direct exact match in ICON_MAP
  const cleanKey = trimmed.toLowerCase().replace(/[-_\s]+/g, '');
  if (ICON_MAP[cleanKey]) {
    return ICON_MAP[cleanKey];
  }

  // 3. Check individual words
  const words = trimmed.toLowerCase().split(/[-_\s]+/);
  for (const w of words) {
    if (ICON_MAP[w]) {
      return ICON_MAP[w];
    }
  }

  // 4. Substring matching for compound keywords (e.g. 'myprinter' -> 'printer')
  for (const [key, emoji] of Object.entries(ICON_MAP)) {
    if (key.length >= 3 && cleanKey.includes(key)) {
      return emoji;
    }
  }

  return fallback;
}

/**
 * Search icon presets by English query
 */
export function searchIconPresets(query: string, maxResults = 8): IconPreset[] {
  if (!query || !query.trim()) {
    return POPULAR_ICON_PRESETS.slice(0, maxResults);
  }
  const q = query.toLowerCase().trim();
  return POPULAR_ICON_PRESETS.filter(
    (p) =>
      p.label.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q) ||
      p.icon.includes(q)
  ).slice(0, maxResults);
}
