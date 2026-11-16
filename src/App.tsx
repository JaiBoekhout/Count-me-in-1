import { PartnersAdminScreen } from "./screens/PartnersAdminScreen"
import { SportsAdminScreen } from "./screens/SportsAdminScreen"
import { ExploreSportsScreen } from "./screens/ExploreSportsScreen"
import { PatchCelebration } from "./components/PatchCelebration"
import { BrandMark } from "./components/BrandMark"
import { rememberReturnPath, takeReturnPath, useAuthGate } from "./lib/authGate"
import {
  createBrowserRouter,
  Navigate,
  Outlet,
  RouterProvider,
  ScrollRestoration,
  useLocation,
  useNavigate,
} from "react-router-dom"
import { useCallback, useEffect, useState } from "react"
import { BottomNav, type Tab } from "./components/BottomNav"
import { ActivityDetailScreen } from "./screens/ActivityDetailScreen"
import { EditActivityScreen } from "./screens/EditActivityScreen"
import { AuthScreen } from "./screens/AuthScreen"
import { useMediaQuery, wideChatLayoutQuery } from "./lib/useMediaQuery"
import { ChatsScreen } from "./screens/ChatsScreen"
import { CreateActivityScreen } from "./screens/CreateActivityScreen"
import { EditProfileScreen } from "./screens/EditProfileScreen"
import { EditSportsScreen } from "./screens/EditSportsScreen"
import { HomeScreen } from "./screens/HomeScreen"
import { MyActivitiesScreen } from "./screens/MyActivitiesScreen"
import { NotificationsScreen } from "./screens/NotificationsScreen"
import { NotificationSettingsScreen } from "./screens/NotificationSettingsScreen"
import { OnboardingScreen } from "./screens/OnboardingScreen"
import { PasswordResetScreen } from "./screens/PasswordResetScreen"
import { PatchesScreen } from "./screens/PatchesScreen"
import { WelcomeScreen } from "./screens/WelcomeScreen"
import { AppTour } from "./components/AppTour"
import { appTourSteps, onStartAppTour } from "./lib/appTour"
import { hasSeenWelcome, markTourFinished } from "./lib/onboardingFlags"
import { supabase } from "./lib/supabase"
import { PersonalRecordsScreen } from "./screens/PersonalRecordsScreen"
import { ProfileFriendsScreen } from "./screens/ProfileFriendsScreen"
import { ProfileScreen } from "./screens/ProfileScreen"
import { MoreAboutScreen } from "./screens/MoreAboutScreen"
import { MoreHelpScreen } from "./screens/MoreHelpScreen"
import { MoreScreen } from "./screens/MoreScreen"
import { MySportsScreen } from "./screens/MySportsScreen"
import { LanguageSettingsScreen } from "./screens/LanguageSettingsScreen"
import { LocationSettingsScreen } from "./screens/LocationSettingsScreen"
import { AdminEditProfileScreen } from "./screens/AdminEditProfileScreen"
import { SendStaffMessageScreen } from "./screens/SendStaffMessageScreen"
import { AllActivitiesScreen } from "./screens/AllActivitiesScreen"
import { TeamScreen } from "./screens/TeamScreen"
import { PrivacySettingsScreen } from "./screens/PrivacySettingsScreen"
import { SportProfileScreen } from "./screens/SportProfileScreen"
import { MatesScreen } from "./screens/MatesScreen"
import { getUnreadChatThreadCount, hasUnreadChatThreads } from "./lib/chat"
import { getUnreadDirectChatCount } from "./lib/directChats"
import { getOpenStaffMessageCount } from "./lib/staffMessages"
import { ModerationScreen } from "./screens/ModerationScreen"

// Pages you can open without being signed in.
const publicPaths = ["/welcome", "/login", "/reset-password"]
const sideNavCollapsedKey = "count-me-in-side-nav-collapsed"

// Read before Supabase handles the link: a password reset link (or its error,
// such as an expired link) can land on any page, depending on Supabase settings.
const initialAuthHash = window.location.hash
const isPasswordLinkLanding =
  /(^|[#&])type=recovery(&|$)/.test(initialAuthHash) || /(^|[#&])error_code=/.test(initialAuthHash)

function AppShell() {
  const location = useLocation()
  const navigate = useNavigate()
  const path = location.pathname

  // A password reset link always opens the reset page, also when it expired.
  useEffect(() => {
    if (isPasswordLinkLanding && location.pathname !== "/reset-password") {
      navigate(`/reset-password${initialAuthHash}`, { replace: true })
    }
    if (!supabase) return
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") navigate("/reset-password", { replace: true })
    })
    return () => subscription.unsubscribe()
    // Only on first load of the app.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Only signed-in members who finished onboarding see the app. Everyone else
  // gets the welcome slides (first visit), the login screen or onboarding.
  const gate = useAuthGate()
  const isPublicPath = publicPaths.includes(path)
  useEffect(() => {
    if (isPasswordLinkLanding) return
    if (gate === 'signedOut' && !isPublicPath) {
      rememberReturnPath(location.pathname + location.search)
      navigate(hasSeenWelcome() ? '/login' : '/welcome', { replace: true })
    } else if (gate === 'needsOnboarding' && path !== '/onboarding' && path !== '/reset-password') {
      navigate('/onboarding', { replace: true })
    } else if (gate === 'ready' && (path === '/login' || path === '/welcome')) {
      navigate(takeReturnPath() ?? '/', { replace: true })
    }
  }, [gate, path, isPublicPath, location.pathname, location.search, navigate])
  const blocked =
    !isPasswordLinkLanding &&
    (gate === 'checking' ||
      (gate === 'signedOut' && !isPublicPath) ||
      (gate === 'needsOnboarding' && path !== '/onboarding' && path !== '/reset-password'))

  const isWideChatLayout = useMediaQuery(wideChatLayoutQuery)
  // Desktop side nav: collapsed to icons or not, remembered on this device.
  const [sideNavCollapsed, setSideNavCollapsed] = useState(() => {
    try {
      return window.localStorage.getItem(sideNavCollapsedKey) === "1"
    } catch {
      return false
    }
  })
  function toggleSideNav() {
    setSideNavCollapsed((current) => {
      try {
        window.localStorage.setItem(sideNavCollapsedKey, current ? "0" : "1")
      } catch {
        // Storage blocked: the choice lasts until the page reloads.
      }
      return !current
    })
  }
  // The app tour lives here so it can move between pages.
  const [tourOpen, setTourOpen] = useState(false)
  useEffect(() => onStartAppTour(() => setTourOpen(true)), [])
  const closeTour = useCallback((finished: boolean) => {
    markTourFinished()
    setTourOpen(false)
    if (finished) navigate("/")
  }, [navigate])
  const [hasUnreadChats, setHasUnreadChats] = useState(hasUnreadChatThreads())
  const [chatUnreadError, setChatUnreadError] = useState("")

  useEffect(() => {
    let active = true
    const refreshUnreadChats = () => {
      void Promise.all([getUnreadChatThreadCount(), getUnreadDirectChatCount().catch(() => 0), getOpenStaffMessageCount().catch(() => 0)])
        .then(([groupCount, directCount, teamCount]) => {
          const count = groupCount + directCount + teamCount
          if (active) {
            setHasUnreadChats(count > 0)
            setChatUnreadError("")
          }
        })
        .catch((error: unknown) => {
          if (active) {
            setChatUnreadError(error instanceof Error ? error.message : "Unread chat status could not be checked.")
          }
        })
    }

    refreshUnreadChats()
    window.addEventListener("count-me-in-chat-unread-changed", refreshUnreadChats)
    return () => {
      active = false
      window.removeEventListener("count-me-in-chat-unread-changed", refreshUnreadChats)
    }
  }, [path])

  const isSideNav = useMediaQuery("(min-width: 980px)")
  const activeTab: Tab | null =
    path === "/notifications"
      ? null
      : // Desktop: More pages are highlighted in the side nav groups instead.
        isSideNav && (path.startsWith("/more") || (path.startsWith("/profile/") && path !== "/profile"))
        ? null
      : path === "/more/friends" || path === "/more/crew" || path === "/more/requests"
        ? "friends"
      : path.startsWith("/more")
        ? "more"
      : path === "/activities" || path === "/create"
        ? "activities"
        : path === "/friends" || path === "/mates"
          ? "friends"
          : path.startsWith("/chats")
            ? "chats"
            : path.startsWith("/profile")
              ? "more"
              : "home"

  const showNav = isSideNav
    ? // Desktop: the side nav stays on every page except sign-in, onboarding and the More overlay.
      !["/login", "/welcome", "/onboarding", "/reset-password", "/more"].includes(path)
    : ![
      "/login",
      "/welcome",
      "/onboarding",
      "/reset-password",
      "/profile/edit",
      "/profile/sports/edit",
    ].includes(path) &&
    !/^\/activity\/[^/]+\/edit$/.test(path) &&
    !(path.startsWith("/chats/") && path !== "/chats" && !isWideChatLayout)

  return (
    <>
      {/* New screens open at the top; Back returns to where you were.
          Switching chats keeps the same scroll position. */}
      <ScrollRestoration
        getKey={(location) =>
          location.pathname.startsWith("/chats") ? "/chats" : location.key
        }
      />
      {/* A size container: grids follow the space next to the side nav, not the window. */}
      {blocked ? (
        <div className="app-gate-splash" role="status" aria-label="Loading Count Me In">
          <BrandMark className="app-gate-logo" />
        </div>
      ) : (
      <div className={`app-content${showNav ? " with-nav" : ""}${sideNavCollapsed ? " nav-collapsed" : ""}`}>
        <Outlet />
      </div>
      )}
      {showNav && !blocked && (
        <BottomNav
          active={activeTab}
          hasUnreadChats={hasUnreadChats}
          chatUnreadError={chatUnreadError}
          collapsed={sideNavCollapsed}
          onToggleCollapsed={toggleSideNav}
        />
      )}
      <PatchCelebration />
      {tourOpen && (
        <AppTour
          steps={appTourSteps}
          onClose={closeTour}
        />
      )}
    </>
  )
}

const router = createBrowserRouter([
  {
    element: <AppShell />,
    children: [
      { path: "/", element: <HomeScreen /> },
      { path: "/login", element: <AuthScreen /> },
      { path: "/welcome", element: <WelcomeScreen /> },
      { path: "/reset-password", element: <PasswordResetScreen /> },
      { path: "/onboarding", element: <OnboardingScreen /> },
      { path: "/activity/:id", element: <ActivityDetailScreen /> },
      { path: "/activity/:id/edit", element: <EditActivityScreen /> },
      { path: "/activities", element: <MyActivitiesScreen /> },
      { path: "/friends", element: <MatesScreen /> },
      { path: "/mates", element: <MatesScreen /> },
      { path: "/notifications", element: <NotificationsScreen /> },
      { path: "/create", element: <CreateActivityScreen /> },
      { path: "/chats", element: <ChatsScreen /> },
      { path: "/chats/:id", element: <ChatsScreen /> },
      { path: "/chats/dm/:id", element: <ChatsScreen /> },
      { path: "/chats/team/:id", element: <ChatsScreen /> },
      { path: "/profile/:name?", element: <ProfileScreen /> },
      { path: "/profile/edit", element: <EditProfileScreen /> },
      { path: "/profile/sports/edit", element: <EditSportsScreen /> },
      { path: "/profile/sports/:sport", element: <SportProfileScreen /> },
      { path: "/profile/:name/sports/:sport", element: <SportProfileScreen /> },
      { path: "/profile/:name/friends", element: <ProfileFriendsScreen /> },
      { path: "/profile/patches", element: <PatchesScreen /> },
      { path: "/profile/records", element: <PersonalRecordsScreen /> },
      { path: "/more", element: <MoreScreen /> },
      { path: "/more/activities", element: <AllActivitiesScreen /> },
      { path: "/more/crew", element: <MatesScreen view="crew" /> },
      { path: "/more/requests", element: <MatesScreen view="requests" /> },
      { path: "/more/friends", element: <Navigate to="/more/crew" replace /> },
      { path: "/more/sports", element: <MySportsScreen /> },
      { path: "/more/notifications", element: <NotificationSettingsScreen /> },
      { path: "/more/privacy", element: <PrivacySettingsScreen /> },
      { path: "/more/language", element: <LanguageSettingsScreen /> },
      { path: "/more/location", element: <LocationSettingsScreen /> },
      { path: "/more/about", element: <MoreAboutScreen /> },
      { path: "/more/help", element: <MoreHelpScreen /> },
      { path: "/more/moderation", element: <ModerationScreen /> },
      { path: "/more/moderation/records", element: <ModerationScreen tab="records" /> },
      { path: "/more/moderation/activities", element: <ModerationScreen tab="activities" /> },
      { path: "/more/moderation/team", element: <TeamScreen /> },
      { path: "/more/moderation/sports", element: <SportsAdminScreen /> },
      { path: "/more/moderation/partners", element: <PartnersAdminScreen /> },
      { path: "/more/explore-sports", element: <ExploreSportsScreen /> },
      { path: "/more/moderation/members/:id/edit", element: <AdminEditProfileScreen /> },
      { path: "/more/moderation/members/:id/message", element: <SendStaffMessageScreen /> },
    ],
  },
])

export default function App() {
  return <RouterProvider router={router} />
}
