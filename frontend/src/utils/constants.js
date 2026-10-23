export const STORAGE_KEYS = {
  profile: 'agentic.profile.v1',
  settings: 'agentic.settings.v1',
  conversations: 'agentic.conversations.v1',
  activeId: 'agentic.activeConversation.v1',
  knowledgeBaseUser: 'agentic.knowledgeBaseUser.v1',
};

export const DEFAULT_SETTINGS = {
  theme: 'dark', // dark | light | system
  enterToSend: true,
  voice: 'en-GB-SoniaNeural', // default voice defined by backend/tts_service/router.py
  speed: 1,
  autoRead: false,
  translateSpeech: false, // STT ?translation=true (Whisper translates to English)
  saveLocally: true,
  confirmDelete: true,
};

export const SPEED_OPTIONS = [0.75, 1, 1.25, 1.5, 2];
export const MAX_MESSAGE_LENGTH = 20000; // backend ChatRequest.message max_length

// Agents known from the backend. Unknown agents are handled by prettify().
export const AGENT_LABELS = {
  web_search_agent: 'Web Search Agent',
  image_search_agent: 'Image Search Agent',
  news_agent: 'News Agent',
  weather_agent: 'Weather Agent',
  utility_agent: 'Utility Agent',
  chat_agent: 'Chat Agent',
  knowledge_base_agent: 'Knowledge Base Agent',
};

// Known tools -> friendly label + category. Unknown tools fall back gracefully.
export const TOOL_META = {
  web_search_tavily: { label: 'Web Search (Tavily)', category: 'web' },
  web_search_free: { label: 'Web Search (DuckDuckGo)', category: 'web' },
  wikipedia_search: { label: 'Wikipedia Search', category: 'web' },
  fetch_webpage: { label: 'Fetch Webpage', category: 'web' },
  image_search_unsplash: { label: 'Image Search (Unsplash)', category: 'image' },
  image_search_free: { label: 'Image Search (DuckDuckGo)', category: 'image' },
  search_news: { label: 'News Search', category: 'news' },
  get_top_headlines: { label: 'Top Headlines', category: 'news' },
  get_current_weather: { label: 'Current Weather', category: 'weather' },
  get_weather_forecast: { label: 'Weather Forecast', category: 'weather' },
  calculator: { label: 'Calculator', category: 'utility' },
  get_current_datetime: { label: 'Date & Time', category: 'utility' },
  convert_units: { label: 'Unit Converter', category: 'utility' },
};

export const CATEGORY_LABELS = {
  web: 'Web search',
  image: 'Image search',
  news: 'News',
  weather: 'Weather',
  utility: 'Utilities',
  other: 'Tool',
};

export const SUGGESTIONS = [
  { icon: 'brain', title: 'Explain a complex technical topic', text: 'Explain a complex technical topic: ' },
  { icon: 'globe', title: 'Search the web for recent developments', text: 'Search the web for recent developments in ' },
  { icon: 'image', title: 'Find images related to a topic', text: 'Find images related to ' },
  { icon: 'newspaper', title: 'Tell me the latest news', text: 'Tell me the latest news about ' },
  { icon: 'cloud', title: 'Check the weather in a city', text: 'Check the weather in ' },
  { icon: 'calculator', title: 'Help me solve a mathematical problem', text: 'Help me solve this math problem: ' },
];

export const PHASE_LABELS = {
  preparing: 'Preparing request',
  routing: 'Laya is routing your request',
  supervisor: 'Supervisor is analyzing your request',
  agent: 'Specialist agent is working',
  tool: 'Running tools',
  answering: 'Generating final answer',
};
