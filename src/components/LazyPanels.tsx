import React, { Suspense } from 'react'

function LoadingFallback({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center h-32 gap-2 text-muted-foreground text-sm" dir="rtl">
      <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
      </svg>
      <span>Loading {label}...</span>
    </div>
  )
}

const DataTable = React.lazy(() => import('./DataTable'))
const AgentChatWindow = React.lazy(() => import('./AgentChatWindow'))
const DashboardBuilder = React.lazy(() => import('./DashboardBuilder'))
const CleaningPanel = React.lazy(() => import('./CleaningPanel'))
const AskData = React.lazy(() => import('./AskData'))

export function LazyDataTable(props: React.ComponentProps<typeof DataTable>) {
  return (
    <Suspense fallback={<LoadingFallback label="Data Table" />}>
      <DataTable {...props} />
    </Suspense>
  )
}

export function LazyAgentChatWindow(props: React.ComponentProps<typeof AgentChatWindow>) {
  return (
    <Suspense fallback={<LoadingFallback label="AI Chat" />}>
      <AgentChatWindow {...props} />
    </Suspense>
  )
}

export function LazyDashboardBuilder(props: React.ComponentProps<typeof DashboardBuilder>) {
  return (
    <Suspense fallback={<LoadingFallback label="Dashboard" />}>
      <DashboardBuilder {...props} />
    </Suspense>
  )
}

export function LazyCleaningPanel(props: React.ComponentProps<typeof CleaningPanel>) {
  return (
    <Suspense fallback={<LoadingFallback label="Cleaning Panel" />}>
      <CleaningPanel {...props} />
    </Suspense>
  )
}

export function LazyAskData(props: React.ComponentProps<typeof AskData>) {
  return (
    <Suspense fallback={<LoadingFallback label="Ask Data" />}>
      <AskData {...props} />
    </Suspense>
  )
}
