export { default } from "next-auth/middleware"

export const config = {
  matcher: [
    "/dashboard/:path*",
    // Add other protected routes here
  ],
}
