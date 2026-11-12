// Password-protects the online InSheepnia playtest.
// The password lives in a Netlify environment variable called PLAY_PASSWORD,
// so it's never written in this file or in your GitHub repo.
// Visitors see the browser's sign-in box: any username works, the password must match.

export default async (request) => {
  const expected = Netlify.env.get("PLAY_PASSWORD");
  if (!expected) {
    return new Response("The playtest isn't open yet.", { status: 503 });
  }

  const auth = request.headers.get("authorization") || "";
  if (auth.startsWith("Basic ")) {
    try {
      const decoded = atob(auth.slice(6));
      const password = decoded.slice(decoded.indexOf(":") + 1);
      if (password === expected) return; // correct: carry on to the page
    } catch (e) {
      // badly formed header: fall through and ask again
    }
  }

  return new Response("You need the password to play the InSheepnia playtest.", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="InSheepnia playtest", charset="UTF-8"',
      "Cache-Control": "no-store",
    },
  });
};

export const config = {
  path: ["/play-insheepnia", "/play-insheepnia.html", "/insheepnia-engine.js"],
};