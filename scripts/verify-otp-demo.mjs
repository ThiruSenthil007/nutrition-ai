process.env.DATABASE_URL = "";

const { appRouter } = await import('../server/routers.ts');

const ctx = {
  user: null,
  req: { protocol: 'https', headers: {} },
  res: {},
};

const caller = appRouter.createCaller(ctx);
const result = await caller.auth.requestOtp({
  mode: 'signup',
  identifier: 'thiru@gmail.com',
  name: 'Thiru',
  email: 'thiru@gmail.com',
  phone: '8072827862',
  dateOfBirth: '2007-01-05',
  age: 19,
});

const verification = await caller.auth.verifyOtp({
  challengeId: result.challengeId,
  code: result.demoCode,
});

console.log(JSON.stringify({
  challengeId: result.challengeId,
  demoCode: result.demoCode,
  verified: verification.verified,
  email: verification.user.email,
}));
