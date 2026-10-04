export default function Dashboard() {
  return (
    <div className="p-12">
      <h1 className="text-5xl font-bold mb-4">Welcome back, Cage</h1>
      <p className="text-xl text-zinc-400">Your CEO GPS dashboard is live. Let's build.</p>
      
      <div className="mt-12 grid grid-cols-3 gap-6">
        <div className="bg-zinc-900 p-8 rounded-3xl border border-zinc-700">
          <h3 className="text-lg mb-2">Revenue This Month</h3>
          <div className="text-6xl font-semibold text-emerald-400">$87,420</div>
        </div>
        {/* More dashboard cards */}
      </div>
    </div>
  );
}