import { useEffect, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import type { AuthUser } from "../types";
import {
  changeAuthorizationPassword,
  changeLoginPassword,
  updateProfileInfo,
} from "../services/api";

type ProfileTabKey = "information" | "login-password" | "authorization-password";

interface InformationFormState {
  displayName: string;
  email: string;
  phone: string;
  address: string;
  remark: string;
}

interface PasswordFormState {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

const profileTabs: Array<{ key: ProfileTabKey; label: string }> = [
  { key: "information", label: "Modify Information" },
  { key: "login-password", label: "Login Password" },
  { key: "authorization-password", label: "Authorization Password" },
];

function createInformationState(user?: AuthUser | null): InformationFormState {
  return {
    displayName: user?.displayName ?? "",
    email: user?.email ?? "",
    phone: user?.phone ?? "",
    address: user?.address ?? "",
    remark: user?.remark ?? "",
  };
}

function createPasswordState(): PasswordFormState {
  return {
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  };
}

function sanitizeEntries<T extends Record<string, string>>(values: T) {
  return Object.entries(values).reduce<Record<string, string>>((accumulator, [key, value]) => {
    const trimmed = value.trim();
    if (trimmed.length > 0) {
      accumulator[key] = trimmed;
    }
    return accumulator;
  }, {});
}

export function ProfilePage() {
  const { user, refreshUser, replaceUser } = useAuth();
  const [activeTab, setActiveTab] = useState<ProfileTabKey>("information");
  const [informationForm, setInformationForm] = useState<InformationFormState>(
    createInformationState(user),
  );
  const [loginPasswordForm, setLoginPasswordForm] = useState<PasswordFormState>(
    createPasswordState(),
  );
  const [authorizationPasswordForm, setAuthorizationPasswordForm] = useState<PasswordFormState>(
    createPasswordState(),
  );
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submittingTab, setSubmittingTab] = useState<ProfileTabKey | null>(null);

  useEffect(() => {
    setInformationForm(createInformationState(user));
  }, [user]);

  const handleInformationSubmit = async () => {
    const payload = sanitizeEntries({
      displayName: informationForm.displayName,
      email: informationForm.email,
      phone: informationForm.phone,
      address: informationForm.address,
      remark: informationForm.remark,
    });

    if (Object.keys(payload).length === 0) {
      setErrorMessage("At least one profile field is required.");
      return;
    }

    setSubmittingTab("information");
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      const result = await updateProfileInfo(payload);
      const nextUser = result.user ?? (await refreshUser());
      if (nextUser) {
        replaceUser(nextUser);
        setInformationForm(createInformationState(nextUser));
      }
      setStatusMessage(result.message || "Profile updated.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to update profile.");
    } finally {
      setSubmittingTab(null);
    }
  };

  const handlePasswordSubmit = async (
    tab: "login-password" | "authorization-password",
    form: PasswordFormState,
  ) => {
    if (!form.currentPassword.trim() || !form.newPassword.trim() || !form.confirmPassword.trim()) {
      setErrorMessage("All password fields are required.");
      return;
    }

    if (form.newPassword.trim().length < 6) {
      setErrorMessage("New password must be at least 6 characters.");
      return;
    }

    if (form.newPassword !== form.confirmPassword) {
      setErrorMessage("Password confirmation does not match.");
      return;
    }

    setSubmittingTab(tab);
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      const payload = {
        oldPassword: form.currentPassword.trim(),
        newPassword: form.newPassword.trim(),
        confirmPassword: form.confirmPassword.trim(),
      };

      const result =
        tab === "login-password"
          ? await changeLoginPassword(payload)
          : await changeAuthorizationPassword(payload);

      if (tab === "login-password") {
        setLoginPasswordForm(createPasswordState());
      } else {
        setAuthorizationPasswordForm(createPasswordState());
      }

      setStatusMessage(result.message || "Password updated.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to update password.");
    } finally {
      setSubmittingTab(null);
    }
  };

  return (
    <section className="page-stack profile-page">
      <div className="toolbar-panel profile-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Account Maintenance</p>
            <h2>Profile</h2>
          </div>
        </div>
        <div className="profile-summary-grid">
          <div className="profile-summary-card">
            <span className="profile-summary-label">Username</span>
            <strong>{user?.username ?? "Unknown"}</strong>
          </div>
          <div className="profile-summary-card">
            <span className="profile-summary-label">Display Name</span>
            <strong>{user?.displayName ?? "Unknown"}</strong>
          </div>
          <div className="profile-summary-card">
            <span className="profile-summary-label">Role</span>
            <strong>{user?.role ?? "Unknown"}</strong>
          </div>
        </div>
      </div>

      <div className="toolbar-panel profile-panel">
        <div className="profile-tab-strip" role="tablist" aria-label="Profile sections">
          {profileTabs.map((tab) => (
            <button
              key={tab.key}
              aria-selected={activeTab === tab.key}
              className={`button ${activeTab === tab.key ? "button-primary" : "button-ghost"}`}
              onClick={() => {
                setActiveTab(tab.key);
                setStatusMessage(null);
                setErrorMessage(null);
              }}
              role="tab"
              type="button"
            >
              {tab.label}
            </button>
          ))}
        </div>

        {statusMessage ? <p className="status-banner">{statusMessage}</p> : null}
        {errorMessage ? <p className="status-banner status-banner-error">{errorMessage}</p> : null}

        {activeTab === "information" ? (
          <form
            className="profile-form-grid"
            onSubmit={(event) => {
              event.preventDefault();
              void handleInformationSubmit();
            }}
          >
            <label className="field">
              <span>Display Name</span>
              <input
                onChange={(event) =>
                  setInformationForm((current) => ({
                    ...current,
                    displayName: event.target.value,
                  }))
                }
                placeholder="Display name"
                type="text"
                value={informationForm.displayName}
              />
            </label>
            <label className="field">
              <span>Email</span>
              <input
                onChange={(event) =>
                  setInformationForm((current) => ({
                    ...current,
                    email: event.target.value,
                  }))
                }
                placeholder="Email address"
                type="email"
                value={informationForm.email}
              />
            </label>
            <label className="field">
              <span>Phone</span>
              <input
                onChange={(event) =>
                  setInformationForm((current) => ({
                    ...current,
                    phone: event.target.value,
                  }))
                }
                placeholder="Phone number"
                type="text"
                value={informationForm.phone}
              />
            </label>
            <label className="field">
              <span>Address</span>
              <input
                onChange={(event) =>
                  setInformationForm((current) => ({
                    ...current,
                    address: event.target.value,
                  }))
                }
                placeholder="Address"
                type="text"
                value={informationForm.address}
              />
            </label>
            <label className="field profile-field-span">
              <span>Remark</span>
              <textarea
                onChange={(event) =>
                  setInformationForm((current) => ({
                    ...current,
                    remark: event.target.value,
                  }))
                }
                placeholder="Optional note"
                rows={4}
                value={informationForm.remark}
              />
            </label>
            <div className="profile-form-actions">
              <button
                className="button button-primary"
                disabled={submittingTab === "information"}
                type="submit"
              >
                {submittingTab === "information" ? "Saving..." : "Save Information"}
              </button>
            </div>
          </form>
        ) : null}

        {activeTab === "login-password" ? (
          <form
            className="profile-form-grid"
            onSubmit={(event) => {
              event.preventDefault();
              void handlePasswordSubmit("login-password", loginPasswordForm);
            }}
          >
            <label className="field">
              <span>Current Password</span>
              <input
                onChange={(event) =>
                  setLoginPasswordForm((current) => ({
                    ...current,
                    currentPassword: event.target.value,
                  }))
                }
                placeholder="Current password"
                type="password"
                value={loginPasswordForm.currentPassword}
              />
            </label>
            <label className="field">
              <span>New Password</span>
              <input
                onChange={(event) =>
                  setLoginPasswordForm((current) => ({
                    ...current,
                    newPassword: event.target.value,
                  }))
                }
                placeholder="New password"
                type="password"
                value={loginPasswordForm.newPassword}
              />
            </label>
            <label className="field">
              <span>Confirm Password</span>
              <input
                onChange={(event) =>
                  setLoginPasswordForm((current) => ({
                    ...current,
                    confirmPassword: event.target.value,
                  }))
                }
                placeholder="Confirm password"
                type="password"
                value={loginPasswordForm.confirmPassword}
              />
            </label>
            <div className="profile-form-actions">
              <button
                className="button button-primary"
                disabled={submittingTab === "login-password"}
                type="submit"
              >
                {submittingTab === "login-password" ? "Updating..." : "Update Login Password"}
              </button>
            </div>
          </form>
        ) : null}

        {activeTab === "authorization-password" ? (
          <form
            className="profile-form-grid"
            onSubmit={(event) => {
              event.preventDefault();
              void handlePasswordSubmit(
                "authorization-password",
                authorizationPasswordForm,
              );
            }}
          >
            <label className="field">
              <span>Current Authorization Password</span>
              <input
                onChange={(event) =>
                  setAuthorizationPasswordForm((current) => ({
                    ...current,
                    currentPassword: event.target.value,
                  }))
                }
                placeholder="Current authorization password"
                type="password"
                value={authorizationPasswordForm.currentPassword}
              />
            </label>
            <label className="field">
              <span>New Authorization Password</span>
              <input
                onChange={(event) =>
                  setAuthorizationPasswordForm((current) => ({
                    ...current,
                    newPassword: event.target.value,
                  }))
                }
                placeholder="New authorization password"
                type="password"
                value={authorizationPasswordForm.newPassword}
              />
            </label>
            <label className="field">
              <span>Confirm Authorization Password</span>
              <input
                onChange={(event) =>
                  setAuthorizationPasswordForm((current) => ({
                    ...current,
                    confirmPassword: event.target.value,
                  }))
                }
                placeholder="Confirm authorization password"
                type="password"
                value={authorizationPasswordForm.confirmPassword}
              />
            </label>
            <div className="profile-form-actions">
              <button
                className="button button-primary"
                disabled={submittingTab === "authorization-password"}
                type="submit"
              >
                {submittingTab === "authorization-password"
                  ? "Updating..."
                  : "Update Authorization Password"}
              </button>
            </div>
          </form>
        ) : null}
      </div>
    </section>
  );
}
