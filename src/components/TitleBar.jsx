import { useState, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "../theme/ThemeContext";
import { TitleBarContext } from "../theme/TitleBarContext";
import { themes } from "../theme/themes";
import { useFontSize } from "../theme/FontSizeContext";
import { useAuth } from "../auth/AuthContext";
import "./TitleBar.css";

export default function TitleBar() {
  const { theme, themeName, setThemeName } = useTheme();
  const { fontSize, setFontSize, SIZES } = useFontSize();
  const { titleBar } = useContext(TitleBarContext);
  const { title, progress, backPath } = titleBar;
  const { activeAuth, logout } = useAuth();
  const navigate = useNavigate();
  const [menuView, setMenuView] = useState(null);

  function closeMenu() {
    setMenuView(null);
  }

  return (
    <div className="titlebar">
      <div className="titlebar__row">
        <div className="titlebar__left">
          {backPath && (
            <button
              onClick={() => navigate(backPath)}
              aria-label="Back"
              className="titlebar__back-btn"
            >
              ←
            </button>
          )}
          <span className="titlebar__title">{title}</span>
        </div>

        <div className="titlebar__menu-wrap">
          <button
            onClick={() => setMenuView((v) => (v ? null : "root"))}
            aria-label="Menu"
            className="titlebar__menu-btn"
          >
            ☰
          </button>

          {menuView && (
            <div className="titlebar__dropdown">
              {menuView === "root" && (
                <>
                  <button
                    onClick={() => setMenuView("profile")}
                    className="titlebar__menu-item"
                  >
                    <span className="titlebar__menu-item-label">Profile</span>
                    <span className="titlebar__menu-item-arrow">›</span>
                  </button>
                  <button
                    onClick={() => setMenuView("themes")}
                    className="titlebar__menu-item"
                  >
                    <span className="titlebar__menu-item-label">Themes</span>
                    <span className="titlebar__menu-item-arrow">›</span>
                  </button>
                  <button
                    onClick={() => setMenuView("fontsize")}
                    className="titlebar__menu-item"
                  >
                    <span className="titlebar__menu-item-label">Text Size</span>
                    <span className="titlebar__menu-item-arrow">›</span>
                  </button>
                </>
              )}

              {menuView === "profile" && (
                <>
                  <button
                    onClick={() => setMenuView("root")}
                    aria-label="Back to menu"
                    className="titlebar__submenu-header"
                  >
                    <span className="titlebar__submenu-back">‹</span>
                    <span className="titlebar__submenu-title">Profile</span>
                  </button>
                  <div className="titlebar__profile-body">
                    <div className="titlebar__profile-field">
                      <div className="titlebar__profile-label">Team</div>
                      <div className="titlebar__profile-value">
                        {activeAuth?.teamName || "—"}
                      </div>
                    </div>
                    <div
                      className="titlebar__profile-field"
                      style={{ marginBottom: 16 }}
                    >
                      <div className="titlebar__profile-label">Contact</div>
                      <div className="titlebar__profile-value--contact">
                        {activeAuth?.contact || "—"}
                      </div>
                    </div>
                    <button
                      onClick={async () => {
                        await logout();
                        closeMenu();
                      }}
                      className="titlebar__signout-btn"
                    >
                      Sign out
                    </button>
                  </div>
                </>
              )}

              {menuView === "themes" && (
                <>
                  <button
                    onClick={() => setMenuView("root")}
                    aria-label="Back to menu"
                    className="titlebar__submenu-header"
                  >
                    <span className="titlebar__submenu-back">‹</span>
                    <span className="titlebar__submenu-title">Themes</span>
                  </button>
                  {Object.keys(themes).map((name) => (
                    <button
                      key={name}
                      onClick={() => {
                        setThemeName(name);
                        closeMenu();
                      }}
                      className="titlebar__theme-btn"
                      style={{
                        background:
                          name === themeName ? theme.accent : "transparent",
                        color: name === themeName ? theme.barText : theme.text,
                        fontWeight: name === themeName ? 700 : 400,
                      }}
                    >
                      <span>{name}</span>
                      {name === themeName && (
                        <span className="titlebar__theme-check">✓</span>
                      )}
                    </button>
                  ))}
                </>
              )}
              {menuView === "fontsize" && (
                <>
                  <button
                    onClick={() => setMenuView("root")}
                    aria-label="Back to menu"
                    className="titlebar__submenu-header"
                  >
                    <span className="titlebar__submenu-back">‹</span>
                    <span className="titlebar__submenu-title">Text Size</span>
                  </button>
                  {SIZES.map((size) => (
                    <button
                      key={size}
                      onClick={() => {
                        setFontSize(size);
                        closeMenu();
                      }}
                      className="titlebar__theme-btn"
                      style={{
                        background:
                          size === fontSize ? theme.accent : "transparent",
                        color: size === fontSize ? theme.barText : theme.text,
                        fontWeight: size === fontSize ? 700 : 400,
                      }}
                    >
                      <span style={{ textTransform: "capitalize" }}>
                        {size}
                      </span>
                      {size === fontSize && (
                        <span className="titlebar__theme-check">✓</span>
                      )}
                    </button>
                  ))}
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {progress && (
        <div
          data-testid="progress-bar"
          className="titlebar__progress-track"
          style={{ height: 6 }}
        >
          <div
            className="titlebar__progress-fill"
            style={{ width: `${(progress.current / progress.total) * 100}%` }}
          />
        </div>
      )}
    </div>
  );
}
