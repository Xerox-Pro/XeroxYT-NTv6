We found the root cause of the deployment issue!

When Vercel builds and runs the backend `server.ts` file in production, it was encountering an error: `Cannot find module @rollup/rollup-linux-x64-gnu`. This happens because `vite` (which depends on `rollup` and its native binaries) was being loaded statically at the top of the file using `import`, even in a production environment where it shouldn't be used.

I've fixed this by separating the Vite server import to only load **dynamically** in the local development environment:
```typescript
if (process.env.NODE_ENV !== "production") {
  const { createServer: createViteServer } = await import("vite");
  // ...
}
```

Now, when you deploy to Vercel, the production server will completely ignore `vite` and natively boot up without crashing on the missing `rollup` dependencies.
