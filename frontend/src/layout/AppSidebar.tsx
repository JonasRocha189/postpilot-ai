import Logo from "@/components/common/Logo";
import { useSidebar } from "@/context/SidebarContext";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation } from "react-router";
import {
  AiIcon,
  BoxCubeIcon,
  CalenderIcon,
  ChevronDownIcon,
  DocsIcon,
  FileIcon,
  FolderIcon,
  GridIcon,
  ImageIcon,
  HorizontaLDots,
  ListIcon,
  PageIcon,
  PieChartIcon,
  TableIcon,
  TaskIcon,
  TimeIcon,
  UserCircleIcon,
} from "../icons";
import { cn } from "../utils";

type NavItem = {
  name: string;
  /** Chave do namespace "app" (itens do PostPilot) */
  appKey?: string;
  /** Chave do namespace "common" (itens do template) */
  key?: string;
  icon: React.ReactNode;
  path?: string;
  /** Desenha uma linha antes do item, separando grupos do menu */
  divider?: boolean;
  new?: boolean;
  target?: string;
  subItems?: {
    name: string;
    appKey?: string;
    key?: string;
    path: string;
    pro?: boolean;
    new?: boolean;
    target?: string;
  }[];
};

const navItems: NavItem[] = [
  {
    icon: <GridIcon fontSize={24} />,
    name: "Dashboard",
    appKey: "nav.dashboard",
    path: "/dashboard",
  },
  {
    icon: <FolderIcon fontSize={24} />,
    name: "Projetos",
    appKey: "nav.projects",
    path: "/projects",
  },
  {
    icon: <TaskIcon fontSize={24} />,
    name: "Assuntos",
    appKey: "nav.subjects",
    path: "/subjects",
  },
  {
    icon: <DocsIcon fontSize={24} />,
    name: "Posts",
    appKey: "nav.posts",
    path: "/posts",
  },
  {
    icon: <ImageIcon fontSize={24} />,
    name: "Imagens",
    appKey: "nav.images",
    path: "/images",
  },
  {
    icon: <CalenderIcon fontSize={24} />,
    name: "Calendário",
    appKey: "nav.calendar",
    path: "/calendar",
  },
  // Divisor: IA e base de conhecimento
  {
    icon: <FileIcon fontSize={24} />,
    name: "Documentos",
    appKey: "nav.documents",
    path: "/documents",
    divider: true,
  },
  {
    icon: <AiIcon fontSize={24} />,
    name: "Agente",
    appKey: "nav.agent",
    path: "/agent",
  },
  {
    icon: <TimeIcon fontSize={24} />,
    name: "Execuções",
    appKey: "nav.agentRuns",
    path: "/agent/runs",
  },
  // Divisor: conta
  {
    icon: <UserCircleIcon fontSize={24} />,
    name: "Perfil",
    appKey: "nav.profile",
    path: "/profile",
    divider: true,
  },
];

// Páginas de demonstração do TailAdmin (referência visual). Remover antes da entrega.
const othersItems: NavItem[] = [
  {
    name: "Páginas",
    key: "pages",
    icon: <PageIcon fontSize={24} />,
    subItems: [
      { name: "Ecommerce", key: "ecommerceHome", path: "/template/ecommerce" },
      { name: "Calendar", key: "calendar", path: "/template/calendar" },
      { name: "User Profile", key: "userProfile", path: "/template/profile" },
      { name: "Blank Page", key: "blankPage", path: "/template/blank" },
    ],
  },
  {
    name: "Forms",
    key: "forms",
    icon: <ListIcon fontSize={24} />,
    subItems: [
      { name: "Form Elements", key: "formElements", path: "/template/form-elements" },
    ],
  },
  {
    name: "Tables",
    key: "tables",
    icon: <TableIcon fontSize={24} />,
    subItems: [
      { name: "Basic Tables", key: "basicTables", path: "/template/basic-tables" },
    ],
  },
  {
    icon: <PieChartIcon fontSize={24} />,
    name: "Charts",
    key: "charts",
    subItems: [
      { name: "Line Chart", key: "lineChart", path: "/template/line-chart" },
      { name: "Bar Chart", key: "barChart", path: "/template/bar-chart" },
    ],
  },
  {
    icon: <BoxCubeIcon fontSize={24} />,
    name: "UI Elements",
    key: "uiElements",
    subItems: [
      { name: "Alerts", key: "alerts", path: "/template/alerts" },
      { name: "Avatar", key: "avatar", path: "/template/avatars" },
      { name: "Badge", key: "badge", path: "/template/badge" },
      { name: "Buttons", key: "buttons", path: "/template/buttons" },
      { name: "Images", key: "images", path: "/template/images" },
      { name: "Videos", key: "videos", path: "/template/videos" },
    ],
  },
];

const TODOS_OS_CAMINHOS = [...navItems, ...othersItems].flatMap((item) => [
  ...(item.path ? [item.path] : []),
  ...(item.subItems?.map((s) => s.path) ?? []),
]);

type OpenSubmenu = {
  type: "main" | "others";
  index: number;
} | null;

// Returns the submenu that contains the current route, if any
const findActiveSubmenu = (pathname: string): OpenSubmenu => {
  let match: OpenSubmenu = null;

  (["main", "others"] as const).forEach((menuType) => {
    const items = menuType === "main" ? navItems : othersItems;

    items.forEach((nav, index) => {
      if (nav.subItems?.some((subItem) => subItem.path === pathname)) {
        match = { type: menuType, index };
      }
    });
  });

  return match;
};

const AppSidebar: React.FC = () => {
  const { isExpanded, isMobileOpen, isHovered, setIsHovered, setIsMobileOpen } =
    useSidebar();
  const { t } = useTranslation();
  const { t: tApp } = useTranslation("app");
  const location = useLocation();

  const label = (item: { name: string; appKey?: string; key?: string }) =>
    item.appKey
      ? tApp(item.appKey)
      : item.key
        ? t(`sidebar.items.${item.key}`)
        : item.name;
  const [openSubmenu, setOpenSubmenu] = useState<OpenSubmenu>(() =>
    findActiveSubmenu(location.pathname),
  );
  // Re-sync the open submenu when the route changes
  const [prevPathname, setPrevPathname] = useState(location.pathname);
  if (prevPathname !== location.pathname) {
    setPrevPathname(location.pathname);
    setOpenSubmenu(findActiveSubmenu(location.pathname));
  }
  const [subMenuHeight, setSubMenuHeight] = useState<Record<string, number>>(
    {},
  );
  const subMenuRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Auto-close sidebar on mobile after route change
  useEffect(() => {
    if (isMobileOpen) {
      setIsMobileOpen(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  // Ativo também nas subpáginas (ex.: /projects/new destaca "Projetos"),
  // mas só o item mais específico (/agent/runs não destaca "Agente")
  const isActive = useCallback(
    (path: string) => {
      const casa = (p: string) =>
        location.pathname === p || location.pathname.startsWith(`${p}/`);
      const melhor = TODOS_OS_CAMINHOS.filter(casa).sort((a, b) => b.length - a.length)[0];
      return melhor === path;
    },
    [location.pathname],
  );

  useEffect(() => {
    if (openSubmenu !== null) {
      const key = `${openSubmenu.type}-${openSubmenu.index}`;
      if (subMenuRefs.current[key]) {
        setSubMenuHeight((prevHeights) => ({
          ...prevHeights,
          [key]: subMenuRefs.current[key]?.scrollHeight || 0,
        }));
      }
    }
  }, [openSubmenu]);

  const handleSubmenuToggle = (index: number, menuType: "main" | "others") => {
    setOpenSubmenu((prevOpenSubmenu) => {
      if (
        prevOpenSubmenu &&
        prevOpenSubmenu.type === menuType &&
        prevOpenSubmenu.index === index
      ) {
        return null;
      }
      return { type: menuType, index };
    });
  };

  const renderMenuItems = (items: NavItem[], menuType: "main" | "others") => (
    <ul className="flex flex-col gap-1">
      {items.map((nav, index) => (
        <li
          key={nav.name}
          className={
            nav.divider
              ? "mt-2 border-t border-gray-200 pt-3 dark:border-gray-800"
              : undefined
          }
        >
          {nav.subItems ? (
            <button
              onClick={() => handleSubmenuToggle(index, menuType)}
              className={`group menu-item ${
                openSubmenu?.type === menuType && openSubmenu?.index === index
                  ? "menu-item-active"
                  : "menu-item-inactive"
              } cursor-pointer ${
                !isExpanded && !isHovered
                  ? "xl:justify-center"
                  : "xl:justify-start"
              }`}
            >
              <span
                className={`menu-item-icon-size ${
                  openSubmenu?.type === menuType && openSubmenu?.index === index
                    ? "menu-item-icon-active"
                    : "menu-item-icon-inactive"
                }`}
              >
                {nav.icon}
              </span>

              {(isExpanded || isHovered || isMobileOpen) && (
                <span className="menu-item-text">
                  {label(nav)}
                </span>
              )}
              {nav.new && (isExpanded || isHovered || isMobileOpen) && (
                <span
                  className={`absolute inset-e-10 ms-auto ${
                    openSubmenu?.type === menuType &&
                    openSubmenu?.index === index
                      ? "menu-dropdown-badge-active"
                      : "menu-dropdown-badge-inactive"
                  } menu-dropdown-badge`}
                >
                  {t("sidebar.badges.new")}
                </span>
              )}
              {(isExpanded || isHovered || isMobileOpen) && (
                <ChevronDownIcon
                  className={`ms-auto h-5 w-5 transition-transform duration-200 ${
                    openSubmenu?.type === menuType &&
                    openSubmenu?.index === index
                      ? "rotate-180 text-brand-500"
                      : ""
                  }`}
                />
              )}
            </button>
          ) : (
            nav.path && (
              <Link
                to={nav.path}
                target={nav.target}
                className={`group menu-item ${
                  isActive(nav.path) ? "menu-item-active" : "menu-item-inactive"
                }`}
              >
                <span
                  className={`menu-item-icon-size ${
                    isActive(nav.path)
                      ? "menu-item-icon-active"
                      : "menu-item-icon-inactive"
                  }`}
                >
                  {nav.icon}
                </span>
                {(isExpanded || isHovered || isMobileOpen) && (
                  <span className="menu-item-text">
                    {label(nav)}
                  </span>
                )}
              </Link>
            )
          )}
          {nav.subItems && (isExpanded || isHovered || isMobileOpen) && (
            <div
              ref={(el) => {
                subMenuRefs.current[`${menuType}-${index}`] = el;
              }}
              className="overflow-hidden transition-all duration-300"
              style={{
                height:
                  openSubmenu?.type === menuType && openSubmenu?.index === index
                    ? `${subMenuHeight[`${menuType}-${index}`]}px`
                    : "0px",
              }}
            >
              <ul className="ms-9 mt-2 space-y-1">
                {nav.subItems.map((subItem) => (
                  <li key={subItem.name}>
                    <Link
                      to={subItem.path}
                      target={subItem.target}
                      className={`menu-dropdown-item ${
                        isActive(subItem.path)
                          ? "menu-dropdown-item-active"
                          : "menu-dropdown-item-inactive"
                      }`}
                    >
                      {label(subItem)}
                      <span className="ms-auto flex items-center gap-1">
                        {subItem.new && (
                          <span
                            className={`ms-auto ${
                              isActive(subItem.path)
                                ? "menu-dropdown-badge-active"
                                : "menu-dropdown-badge-inactive"
                            } menu-dropdown-badge`}
                          >
                            {t("sidebar.badges.new")}
                          </span>
                        )}
                        {subItem.pro && (
                          <span
                            className={`ms-auto ${
                              isActive(subItem.path)
                                ? "menu-dropdown-badge-pro-active"
                                : "menu-dropdown-badge-pro-inactive"
                            } menu-dropdown-badge-pro`}
                          >
                            {t("sidebar.badges.pro")}
                          </span>
                        )}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </li>
      ))}
    </ul>
  );

  return (
    <aside
      className={cn(
        "fixed inset-s-0 top-0 z-50 flex h-screen flex-col border-e border-gray-200 bg-white px-5 text-gray-900 transition-all duration-300 ease-in-out xl:translate-x-0 xl:rtl:translate-x-0 dark:border-gray-800 dark:bg-gray-900",
        isExpanded || isMobileOpen ? "w-72.5" : isHovered ? "w-72.5" : "w-22.5",
        isMobileOpen
          ? "translate-x-0"
          : "-translate-x-full rtl:translate-x-full",
      )}
      onMouseEnter={() => !isExpanded && setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div
        className={cn(
          "flex py-8",
          !isExpanded && !isHovered ? "xl:justify-center" : "justify-start",
        )}
      >
        <Link to="/dashboard" aria-label="PostPilot">
          <Logo iconOnly={!(isExpanded || isHovered || isMobileOpen)} />
        </Link>
      </div>

      <div className="no-scrollbar flex flex-col overflow-y-auto duration-300 ease-linear">
        <nav className="mb-6">
          <div className="flex flex-col gap-4">
            <div>
              <h2
                className={`mb-4 flex text-xs leading-5 text-gray-400 uppercase ${
                  !isExpanded && !isHovered
                    ? "xl:justify-center"
                    : "justify-start"
                }`}
              >
                {isExpanded || isHovered || isMobileOpen ? (
                  tApp("nav.menu")
                ) : (
                  <HorizontaLDots className="size-6" />
                )}
              </h2>
              {renderMenuItems(navItems, "main")}
            </div>

            <div>
              <h2
                className={`mb-4 flex text-xs leading-5 text-gray-400 uppercase ${
                  !isExpanded && !isHovered
                    ? "xl:justify-center"
                    : "justify-start"
                }`}
              >
                {isExpanded || isHovered || isMobileOpen ? (
                  tApp("nav.templateGroup")
                ) : (
                  <HorizontaLDots className="size-6" />
                )}
              </h2>
              {renderMenuItems(othersItems, "others")}
            </div>
          </div>
        </nav>
      </div>
    </aside>
  );
};

export default AppSidebar;
