import { withAuth } from "next-auth/middleware"

export default withAuth({
  // Matches the pages.signIn option in authOptions
  pages: {
    signIn: "/login",
  },
})

export const config = {
  matcher: [
    "/dashboard/:path*",
  ],
}
