// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: deep-gray; icon-glyph: magic;

// Change these to your usernames!
const user = "anikait";

// API PARAMETERS !important
// WEATHER_API_KEY, you need an Open Weather API Key
// You can get one for free at: https://home.openweathermap.org/api_keys (account needed).
const WEATHER_API_KEY = "";
const DEFAULT_LOCATION = {
  latitude: 0,
  longitude: 0
};
const WORK_CALENDAR_NAME = 'Personal';
const PERSONAL_CALENDAR_NAME = 'School';
const UPCOMING_SAT_PASS_URL = "https://in-the-sky.org/satpasses.php";

const Cache = importModule('cache');

const cache = new Cache("termiWidgetCache");
const data = await fetchData();
const widget = createWidget(data);
Script.setWidget(widget);
Script.complete();

function createWidget(data) {
  console.log(data)
  const w = new ListWidget()
  const bgColor = new LinearGradient()
  bgColor.colors = [new Color("#29323c"), new Color("#1c1c1c")]
  bgColor.locations = [0.0, 1.0]
  w.backgroundGradient = bgColor
  w.setPadding(12, 15, 15, 12)

  const stack = w.addStack();
  stack.layoutHorizontally();

  const leftStack = stack.addStack();
  leftStack.layoutVertically();
  leftStack.spacing = 6;
  leftStack.size = new Size(200, 0);

  const time = new Date()
  const dfTime = new DateFormatter()
  dfTime.locale = "en"
  dfTime.useMediumDateStyle()
  dfTime.useNoTimeStyle()

  const firstLine = leftStack.addText(`[] ${user} ~$ now`)
  firstLine.textColor = Color.white()
  firstLine.textOpacity = 0.7
  firstLine.font = new Font("Menlo", 11)
  
  const timeLine = leftStack.addText(`[🗓] ${dfTime.string(time)}`)
  timeLine.textColor = Color.white()
  timeLine.font = new Font("Menlo", 11)

  const nextPersonalCalendarEventLine = stack.addText(`🗓 | ${getCalendarEventTitle(data.nextPersonalEvent, false)}`);
  nextPersonalCalendarEventLine.textColor = new Color(COLORS.personalCalendar);
  nextPersonalCalendarEventLine.font = new Font(FONT_NAME, FONT_SIZE);

  const nextWorkCalendarEventLine = stack.addText(`🗓 | ${getCalendarEventTitle(data.nextWorkEvent, true)}`);
  nextWorkCalendarEventLine.textColor = new Color(COLORS.workCalendar);
  nextWorkCalendarEventLine.font = new Font(FONT_NAME, FONT_SIZE);
  
  const batteryLine = leftStack.addText(`[🔋] ${renderBattery()}`)
  batteryLine.textColor = new Color("#6ef2ae")
  batteryLine.font = new Font("Menlo", 11)
  
  const locationLine = leftStack.addText(`[️️📍] Location: ${data.weather.location}`)
  locationLine.textColor = new Color("#7dbbae")
  locationLine.font = new Font("Menlo", 11)
  
  const satLine = leftStack.addText(`[🛰] ${data.satPass}`);
  satLine.textColor = new Color("#ffcc66")
  satLine.font = new Font("Menlo", 11)

  stack.addSpacer();
  const rightStack = stack.addStack();
  rightStack.spacing = 2;
  rightStack.layoutVertically();
  rightStack.bottomAlignContent();

  addWeatherLine(rightStack, data.weather.icon, 32);
  addWeatherLine(rightStack, `${data.weather.description}, ${data.weather.temperature}°`, 12, true);
  addWeatherLine(rightStack, `High: ${data.weather.high}°`);
  addWeatherLine(rightStack, `Low: ${data.weather.low}°`);
  addWeatherLine(rightStack, `Wind: ${data.weather.wind} mph`);

  return w
}

function addWeatherLine(w, text, size, bold) {
  const stack = w.addStack();
  stack.setPadding(0, 0, 0, 0);
  stack.layoutHorizontally();
  stack.addSpacer();
  const line = stack.addText(text);
  line.textColor = new Color("#ffcc66");
  line.font = new Font("Menlo" + (bold ? "-Bold" : ""), size || 11);
}

async function fetchData() {
  const weather = await fetchWeather();
  const nextWorkEvent = await fetchNextCalendarEvent(WORK_CALENDAR_NAME);
  const nextPersonalEvent = await fetchNextCalendarEvent(PERSONAL_CALENDAR_NAME);
  const satPass = await fetchNextSatPass();
  
  return {
    weather,
    nextWorkEvent,
    nextPersonalEvent,
    satPass,
  }
}

function renderBattery() {
  const batteryLevel = Device.batteryLevel()
  const juice = "#".repeat(Math.floor(batteryLevel * 8))
  const used = ".".repeat(8 - juice.length)
  const batteryAscii = `[${juice}${used}] ${Math.round(batteryLevel * 100)}%`
  return batteryAscii
}

async function fetchWeather() {
  let location = await cache.read('location');
  if (!location) {
    try {
      Location.setAccuracyToThreeKilometers();
      location = await Location.current();
    } catch(error) {
      location = await cache.read('location');
    }
  }
  if (!location) {
    location = DEFAULT_LOCATION;
  }
  const address = await Location.reverseGeocode(location.latitude, location.longitude);
  const url = "https://api.openweathermap.org/data/2.5/onecall?lat=" + location.latitude + "&lon=" + location.longitude + "&exclude=minutely,hourly,alerts&units=imperial&lang=en&appid=" + WEATHER_API_KEY;
  const data = await fetchJson(`weather_${address[0].locality}`, url);

  return {
    location: address[0].locality,
    icon: getWeatherEmoji(data.current.weather[0].id, ((new Date()).getTime() / 1000) >= data.current.sunset),
    description: data.current.weather[0].main,
    temperature: Math.round(data.current.temp),
    wind: Math.round(data.current.wind_speed),
    high: Math.round(data.daily[0].temp.max),
    low: Math.round(data.daily[0].temp.min),
  }
}


async function fetchNextSatPass() {  
  const passes = await fetchJson('upcoming-passes.json', UPCOMING_SAT_PASS_URL);
  const now = new Date();
  const nextPass = passes
    .filter((p) => now.getTime() < p.end)[0];

  if (!nextPass) {
    return 'No more passes today';
  }

  if (nextPass.start > now.getTime()) {
    const minutes = Math.round(((nextPass.start - now.getTime()) / 1000) / 60);
    const hours = Math.round((((nextPass.start - now.getTime()) / 1000) / 60) / 60);
    
    if (minutes > 59) {
      return `${nextPass.satellite} in ${hours}h, ${Math.round(nextPass.elevation)}°`;
    } else {
      return `${nextPass.satellite} in ${minutes}m, ${Math.round(nextPass.elevation)}°`;
    }
  } else {
    return `${nextPass.satellite} for ${Math.round(((nextPass.end - now.getTime()) / 1000) / 60)}m, ${Math.round(nextPass.elevation)}°`;
  }
}

async function fetchJson(key, url, headers) {
  const cached = await cache.read(key, 5);
  if (cached) {
    return cached;
  }

  try {
    console.log(`Fetching url: ${url}`);
    const req = new Request(url);
    req.headers = headers;
    const resp = await req.loadJSON();
    cache.write(key, resp);
    return resp;
  } catch (error) {
    try {
      return cache.read(key, 5);
    } catch (error) {
      console.log(`Couldn't fetch ${url}`);
    }
  }
}

// calendar
async function fetchNextCalendarEvent(calendarName) {
  const calendar = await Calendar.forEventsByTitle(calendarName);
  const events = await CalendarEvent.today([calendar]);
  const tomorrow = await CalendarEvent.tomorrow([calendar]);

  console.log(`Got ${events.length} events for ${calendarName}`);
  console.log(`Got ${tomorrow.length} events for ${calendarName} tomorrow`);

  const upcomingEvents = events
    .concat(tomorrow)
    .filter(e => (new Date(e.endDate)).getTime() >= (new Date()).getTime())
    .filter(e => e.attendees && e.attendees.some(a => a.isCurrentUser && a.status === 'accepted'));

  return upcomingEvents ? upcomingEvents[0] : null;
}

function getCalendarEventTitle(calendarEvent, isWorkEvent) {
  if (!calendarEvent) {
    return `No upcoming ${isWorkEvent ? 'work ' : ''}events`;
  }

  const timeFormatter = new DateFormatter();
  timeFormatter.locale = 'en';
  timeFormatter.useNoDateStyle();
  timeFormatter.useShortTimeStyle();

  const eventTime = new Date(calendarEvent.startDate);

  return `[${timeFormatter.string(eventTime)}] ${calendarEvent.title}`;
}

// weather
function getWeatherEmoji(code, isNight) {
  if (code >= 200 && code < 300 || code == 960 || code == 961) {
    return "⛈"
  } else if ((code >= 300 && code < 600) || code == 701) {
    return "🌧"
  } else if (code >= 600 && code < 700) {
    return "❄️"
  } else if (code == 711) {
    return "🔥" 
  } else if (code == 800) {
    return isNight ? "🌕" : "☀️" 
  } else if (code == 801) {
    return isNight ? "☁️" : "🌤"  
  } else if (code == 802) {
    return isNight ? "☁️" : "⛅️"  
  } else if (code == 803) {
    return isNight ? "☁️" : "🌥" 
  } else if (code == 804) {
    return "☁️"  
  } else if (code == 900 || code == 962 || code == 781) {
    return "🌪" 
  } else if (code >= 700 && code < 800) {
    return "🌫" 
  } else if (code == 903) {
    return "🥶"  
  } else if (code == 904) {
    return "🥵" 
  } else if (code == 905 || code == 957) {
    return "💨" 
  } else if (code == 906 || code == 958 || code == 959) {
    return "🧊" 
  } else {
    return "❓" 
  }
}
