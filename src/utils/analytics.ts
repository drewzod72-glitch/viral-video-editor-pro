export interface AnalyticsEvent {
  name: string;
  properties?: Record<string, any>;
  timestamp: number;
}

const EVENT_QUEUE_KEY = 'avve_analytics_queue';
const MAX_QUEUE_SIZE = 50;

export function trackEvent(name: string, properties?: Record<string, any>) {
  const event: AnalyticsEvent = {
    name,
    properties,
    timestamp: Date.now(),
  };

  try {
    const queue = getQueue();
    queue.push(event);
    if (queue.length > MAX_QUEUE_SIZE) queue.shift();
    localStorage.setItem(EVENT_QUEUE_KEY, JSON.stringify(queue));
  } catch {
    // Storage full or unavailable — silently drop
  }
}

export function getQueue(): AnalyticsEvent[] {
  try {
    const raw = localStorage.getItem(EVENT_QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function clearQueue() {
  try {
    localStorage.removeItem(EVENT_QUEUE_KEY);
  } catch {
    // ignore
  }
}

export function getAnalyticsSummary() {
  const queue = getQueue();
  const summary: Record<string, number> = {};
  queue.forEach((e) => {
    summary[e.name] = (summary[e.name] || 0) + 1;
  });
  return { total: queue.length, events: summary };
}
