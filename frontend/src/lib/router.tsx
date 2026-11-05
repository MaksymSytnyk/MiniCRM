import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useCallback,
  useState,
  forwardRef,
  type ReactNode,
  type AnchorHTMLAttributes,
} from "react";
interface Location {
  pathname: string;
  search: string;
}
const RouterContext = createContext<{
  location: Location;
  navigate: (to: string, replace?: boolean) => void;
}>(null!);
function readLocation() {
  return { pathname: window.location.pathname, search: window.location.search };
}
export function BrowserRouter({ children }: { children: ReactNode }) {
  const [location, setLocation] = useState(readLocation);
  useEffect(() => {
    const pop = () => setLocation(readLocation());
    window.addEventListener("popstate", pop);
    return () => window.removeEventListener("popstate", pop);
  }, []);
  const navigate = useCallback((to: string, replace = false) => {
    if (replace) window.history.replaceState(null, "", to);
    else window.history.pushState(null, "", to);
    setLocation(readLocation());
    window.scrollTo(0, 0);
  }, []);
  return (
    <RouterContext.Provider value={{ location, navigate }}>
      {children}
    </RouterContext.Provider>
  );
}
export const useLocation = () => useContext(RouterContext).location;
export const useNavigate = () => useContext(RouterContext).navigate;
export function useParams() {
  const { pathname } = useLocation();
  return { id: pathname.match(/^\/clients\/([^/]+)$/)?.[1] };
}
export function useSearchParams(): [
  URLSearchParams,
  (value: URLSearchParams) => void,
] {
  const location = useLocation();
  const navigate = useNavigate();
  const params = useMemo(
    () => new URLSearchParams(location.search),
    [location.search],
  );
  return [
    params,
    (value) =>
      navigate(
        `${location.pathname}${value.size ? "?" + value.toString() : ""}`,
        true,
      ),
  ];
}
interface LinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  to: string;
}
export const Link = forwardRef<HTMLAnchorElement, LinkProps>(
  ({ to, onClick, children, ...props }, ref) => {
    const navigate = useNavigate();
    return (
      <a
        ref={ref}
        href={to}
        {...props}
        onClick={(e) => {
          onClick?.(e);
          if (
            !e.defaultPrevented &&
            e.button === 0 &&
            !e.metaKey &&
            !e.ctrlKey &&
            !e.shiftKey &&
            !e.altKey &&
            (!props.target || props.target === "_self")
          ) {
            e.preventDefault();
            navigate(to);
          }
        }}
      >
        {children}
      </a>
    );
  },
);
Link.displayName = "Link";
export function NavLink({
  to,
  end = false,
  className,
  ...props
}: Omit<LinkProps, "className"> & {
  end?: boolean;
  className?: string | ((state: { isActive: boolean }) => string);
}) {
  const { pathname } = useLocation();
  const isActive = end
    ? pathname === to
    : pathname === to || pathname.startsWith(to + "/");
  return (
    <Link
      to={to}
      className={
        typeof className === "function" ? className({ isActive }) : className
      }
      aria-current={isActive ? "page" : undefined}
      {...props}
    />
  );
}
