import * as z from 'zod';

const videoId = /^[\w-]{11}$/u;
/** A start time: seconds (`90`, `90s`) or hours, minutes and seconds (`1m30s`). */
const startTime = /^(?=\d)(?:\d+h)?(?:\d+m)?(?:\d+s?)?$/u;
const watchHosts = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com']);

/**
 * A YouTube video link, as pasted from YouTube's Share button or the address
 * bar. It parses to the short `https://youtu.be/<id>` form, keeping only a
 * start time, so share-tracking parameters such as `si` never ship.
 */
export const youtubeUrl = z.string().transform((value, context) => {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    context.addIssue({ code: 'custom', message: `"${value}" is not a link.` });
    return z.NEVER;
  }
  const id =
    url.hostname === 'youtu.be'
      ? url.pathname.replace(/^\/|\/$/gu, '')
      : watchHosts.has(url.hostname) && url.pathname === '/watch'
        ? (url.searchParams.get('v') ?? '')
        : '';
  if (url.protocol !== 'https:' || !videoId.test(id)) {
    context.addIssue({ code: 'custom', message: `"${value}" is not a YouTube video link.` });
    return z.NEVER;
  }
  const start = url.searchParams.get('t');
  if (start === null) {
    return `https://youtu.be/${id}`;
  }
  if (!startTime.test(start)) {
    context.addIssue({
      code: 'custom',
      message: `"${value}" has a start time, t=${start}, that is not like 90, 90s or 1m30s.`,
    });
    return z.NEVER;
  }
  return `https://youtu.be/${id}?t=${start}`;
});
