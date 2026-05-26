// Sunrise/sunset calculation based on NOAA solar position algorithm
// Returns times in local timezone

export interface DaylightInfo {
  sunrise: string;         // HH:MM local time
  sunset: string;          // HH:MM local time
  solarNoon: string;       // HH:MM local time
  dayLengthHours: number;  // total daylight hours
  civilTwilightEnd: string; // HH:MM when sun is 6° below horizon (end of civil twilight)
  isPolarDay: boolean;
  isPolarNight: boolean;
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function toDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}

function sin(x: number): number {
  return Math.sin(x);
}

function cos(x: number): number {
  return Math.cos(x);
}

function asin(x: number): number {
  return Math.asin(Math.max(-1, Math.min(1, x)));
}

function acos(x: number): number {
  return Math.acos(Math.max(-1, Math.min(1, x)));
}

function tan(x: number): number {
  return Math.tan(x);
}

function mod(a: number, b: number): number {
  return ((a % b) + b) % b;
}

function hoursToHm(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

export function calcSunriseSunset(
  latDeg: number,
  lngDeg: number,
  date: Date,
  tzOffsetHours?: number
): DaylightInfo {
  const tz = tzOffsetHours ?? -date.getTimezoneOffset() / 60;

  // Julian day
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();

  const y = year;
  const m = month;
  const d = day;

  const J1 = Math.floor(367 * y - Math.floor(7 * (y + Math.floor((m + 9) / 12)) / 4) + Math.floor(275 * m / 9) + d + 1721013.5);

  // Julian day at UT noon
  const julianDay = J1 - 0.5;

  // Julian century
  const T = (julianDay - 2451545.0) / 36525;

  // Solar noon
  const lw = -lngDeg;
  const n = julianDay - 2451545.0 + 0.0008;
  const Jstar = n - lw / 360;
  const M = mod(357.5291 + 0.98560028 * Jstar, 360);
  const C = 1.9148 * sin(toRad(M)) + 0.02 * sin(toRad(2 * M)) + 0.0003 * sin(toRad(3 * M));
  const lambda = mod(M + C + 180 + 102.9372, 360);
  const Jtransit = 2451545.0 + Jstar + 0.0053 * sin(toRad(M)) - 0.0069 * sin(toRad(2 * lambda));
  const solarNoonJd = Jtransit;

  // Solar declination
  const sinDelta = sin(toRad(lambda)) * sin(toRad(23.44));
  const delta = asin(sinDelta);

  // Hour angle
  const latRad = toRad(latDeg);
  const cosHa = (sin(toRad(-0.833)) - sin(latRad) * sin(delta)) / (cos(latRad) * cos(delta));

  let isPolarDay = false;
  let isPolarNight = false;

  if (cosHa > 1) {
    isPolarNight = true;
    return {
      sunrise: '--:--',
      sunset: '--:--',
      solarNoon: hoursToHm(mod(solarNoonJd - 2451545.0, 1) * 24 + tz),
      dayLengthHours: 0,
      civilTwilightEnd: '--:--',
      isPolarDay: false,
      isPolarNight: true,
    };
  }

  if (cosHa < -1) {
    isPolarDay = true;
    return {
      sunrise: '--:--',
      sunset: '--:--',
      solarNoon: hoursToHm(mod(solarNoonJd - 2451545.0, 1) * 24 + tz),
      dayLengthHours: 24,
      civilTwilightEnd: '--:--',
      isPolarDay: true,
      isPolarNight: false,
    };
  }

  const Ha = acos(cosHa);

  // Sunrise/Sunset in Julian day fraction
  const sunriseJd = Jtransit - toDeg(Ha) / 360;
  const sunsetJd = Jtransit + toDeg(Ha) / 360;

  // Civil twilight (sun 6° below horizon)
  const cosTwilight = (sin(toRad(-6)) - sin(latRad) * sin(delta)) / (cos(latRad) * cos(delta));
  let civilTwilightEnd = sunsetJd;
  if (cosTwilight >= -1 && cosTwilight <= 1) {
    const twilightHa = acos(cosTwilight);
    civilTwilightEnd = Jtransit + toDeg(twilightHa) / 360;
  } else if (cosTwilight < -1) {
    civilTwilightEnd = sunsetJd + 0.1; // approximate
  } else {
    civilTwilightEnd = sunsetJd;
  }

  // Convert Julian day fractions to local time in hours
  const sunriseHours = mod(sunriseJd - 2451545.0, 1) * 24 + tz;
  const sunsetHours = mod(sunsetJd - 2451545.0, 1) * 24 + tz;
  const solarNoonHours = mod(solarNoonJd - 2451545.0, 1) * 24 + tz;
  const twilightHours = mod(civilTwilightEnd - 2451545.0, 1) * 24 + tz;

  const dayLength = sunsetHours - sunriseHours;

  return {
    sunrise: hoursToHm(mod(sunriseHours, 24)),
    sunset: hoursToHm(mod(sunsetHours, 24)),
    solarNoon: hoursToHm(mod(solarNoonHours, 24)),
    dayLengthHours: Math.abs(dayLength),
    civilTwilightEnd: hoursToHm(mod(twilightHours, 24)),
    isPolarDay: false,
    isPolarNight: false,
  };
}
