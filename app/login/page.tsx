import { login, signup } from './actions'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>
}) {
  const { message } = await searchParams

  return (
    <div className="flex-1 flex flex-col w-full px-8 sm:max-w-md justify-center gap-2 text-white bg-black h-screen mx-auto">
      <form className="animate-in flex-1 flex flex-col w-full justify-center gap-2 text-foreground">
        <h1 className="text-3xl font-bold mb-6 tracking-tighter">Sign In</h1>
        
        <label className="text-md font-medium text-gray-300" htmlFor="email">
          Email
        </label>
        <input
          className="rounded-md px-4 py-2 bg-[#1a1a1a] border border-[#333] mb-4 text-white focus:outline-none focus:border-[#5E87C9]"
          name="email"
          placeholder="you@example.com"
          required
        />
        <label className="text-md font-medium text-gray-300" htmlFor="password">
          Password
        </label>
        <input
          className="rounded-md px-4 py-2 bg-[#1a1a1a] border border-[#333] mb-6 text-white focus:outline-none focus:border-[#5E87C9]"
          type="password"
          name="password"
          placeholder="••••••••"
          required
        />
        
        <button
          formAction={login}
          className="bg-[#5E87C9] hover:bg-[#4a6ca0] rounded-md px-4 py-2 text-white mb-2 font-medium transition-colors"
        >
          Sign In
        </button>
        {/* Optional: Add sign up button if you want to allow self-registration */}
        {/* <button
          formAction={signup}
          className="border border-[#333] rounded-md px-4 py-2 text-white mb-2 font-medium hover:bg-[#1a1a1a] transition-colors"
        >
          Sign Up
        </button> */}
        
        {message && (
          <p className="mt-4 p-4 bg-red-900/50 text-red-400 text-center rounded">
            {message}
          </p>
        )}
      </form>
    </div>
  )
}
