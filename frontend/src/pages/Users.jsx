import { callOperation } from "../api/operations";
import QueryStatus from "../components/QueryStatus";
import { queryKeys } from "../app/queryKeys";
import { useResourceQuery, useResourceMutation } from "../app/resourceQueries";
import Modal from "../components/Modal";
import { useDialog } from "../contexts/DialogContext";
import React, { useState } from "react";
import { useToast } from "../contexts/ToastContext";

import {
  Trash2,
  UserPlus,
  Shield,
  RefreshCw,
  Copy,
  Check,
  UserCog,
  Ban,
  Lock,
  Unlock,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { logger } from "../utils/logger";
const Users = () => {
  const { confirmAction } = useDialog();
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingUser, setEditingUser] = useState(
    /** @type {import("../api/generated/contract").components["schemas"]["UserResponse"] | null} */ (
      null
    ),
  );

  // Invite state
  const [inviteRole, setInviteRole] = useState(
    /** @type {"admin" | "moderator" | "user"} */ ("user"),
  );
  const [generatedLink, setGeneratedLink] = useState(null);
  const [copied, setCopied] = useState(false);

  // Edit state
  const [editRole, setEditRole] = useState(
    /** @type {"admin" | "moderator" | "user"} */ ("user"),
  );
  const [editActive, setEditActive] = useState(true);
  const { addToast } = useToast();
  const write = useResourceMutation(
    ({ id, options }, { session }) =>
      callOperation(id, { ...options, session }),
    [queryKeys.users()],
  );
  /** @type {typeof callOperation} */
  const writeOperation = (id, ...args) =>
    write.mutateAsync({ id, options: args[0] });

  const actionLoading = write.isPending;

  const { user: currentUser } = useAuth();
  const resourceQuery = useResourceQuery("users", undefined);
  const users = resourceQuery.data ?? [];
  const loading = resourceQuery.isFetching;
  const fetchUsers = async () => {
    const result = await resourceQuery.refetch();
    if (result.error) addToast(result.error.message, "error");
    return result.isSuccess;
  };
  const handleRefresh = async () => {
    const success = await fetchUsers();
    if (success) {
      addToast("Users list refreshed", "success");
    }
  };
  const handleDelete = async (userToDelete) => {
    if (userToDelete.role === "admin") {
      const adminCount = users.filter(
        (u) => u.role === "admin" && u.is_active,
      ).length;
      if (adminCount <= 1) {
        addToast(
          "Cannot delete the last active administrator account.",
          "error",
        );
        return;
      }
    }
    if (
      !(await confirmAction(
        `Are you sure you want to delete user ${userToDelete.username}?`,
      ))
    )
      return;

    try {
      await writeOperation("delete_user", {
        path: { user_id: userToDelete.id },
      });
      addToast(`User ${userToDelete.username} deleted.`, "success");
      await fetchUsers();
    } catch (error) {
      logger.error("[Users] Delete failed", {
        error,
        userId: userToDelete?.id,
        username: userToDelete?.username,
      });
      addToast(error.message || "Failed to delete user.", "error");
    }
  };
  const handleGenerateLink = async (e) => {
    e.preventDefault();

    try {
      const response = await writeOperation("generate_registration_token", {
        body: {
          role: inviteRole,
        },
      });
      logger.debug("[Users] Generate token response", {
        response,
        inviteRole,
      });
      if (response && response.registration_url) {
        let finalLink = response.registration_url;
        try {
          const urlObj = new URL(response.registration_url);
          finalLink = `${window.location.origin}${urlObj.pathname}`;
        } catch {
          if (response.registration_url.startsWith("/")) {
            finalLink = `${window.location.origin}${response.registration_url}`;
          }
        }
        setGeneratedLink(finalLink);
        addToast("Invitation link generated.", "success");
      } else {
        addToast("Failed to generate link.", "error");
      }
    } catch (error) {
      addToast(error.message || "Failed to generate invitation link.", "error");
    }
  };
  const openEditModal = (user) => {
    if (user.id === currentUser?.id) {
      addToast(
        "You cannot edit your own role/status here. Go to 'Account' page.",
        "warning",
      );
      return;
    }
    setEditingUser(user);
    setEditRole(user.role);
    setEditActive(user.is_active);
    setShowEditModal(true);
  };
  const saveUserChanges = async () => {
    if (!editingUser) return;

    try {
      let updated = false;

      // Update Role if changed
      if (editRole !== editingUser.role) {
        await writeOperation("update_user_role", {
          path: { user_id: editingUser.id },
          body: {
            role: editRole,
          },
        });
        updated = true;
      }

      // Update Status if changed
      if (editActive !== editingUser.is_active) {
        const endpoint = editActive ? "enable" : "disable";
        await writeOperation(
          /** @type {const} */ ({
            enable: "enable_user",
            disable: "disable_user",
          })[endpoint],
          { path: { user_id: editingUser.id } },
        );
        updated = true;
      }
      if (updated) {
        addToast(
          `User ${editingUser.username} updated successfully.`,
          "success",
        );
        setShowEditModal(false);
        setEditingUser(null);
        await fetchUsers();
      } else {
        addToast("No changes made.", "info");
        setShowEditModal(false);
      }
    } catch (error) {
      logger.error("[Users] Update failed", {
        error,
        editingUser,
      });
      addToast(error.message || "Failed to update user.", "error");
    }
  };
  const copyToClipboard = async () => {
    if (generatedLink) {
      try {
        await navigator.clipboard.writeText(generatedLink);
      } catch {
        addToast(
          "Could not copy the link. Select and copy it manually.",
          "error",
        );
        return;
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      addToast("Link copied to clipboard", "success");
    }
  };
  const closeInviteModal = () => {
    setShowInviteModal(false);
    setGeneratedLink(null);
    setInviteRole("user");
  };
  const isAdmin = currentUser?.role === "admin";
  return (
    <div className="container">
      <QueryStatus query={resourceQuery} />
      <div
        className="header"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <h1>User Management</h1>
        <div
          style={{
            display: "flex",
            gap: "calc(10px * var(--bsm-spacing-scale))",
          }}
        >
          <button
            className="action-button secondary"
            onClick={handleRefresh}
            disabled={loading || actionLoading}
            type="button"
          >
            <RefreshCw
              size={16}
              style={{
                marginRight: "calc(5px * var(--bsm-spacing-scale))",
              }}
              className={loading ? "spin" : ""}
            />{" "}
            Refresh
          </button>
          {isAdmin && (
            <button
              className="action-button"
              onClick={() => setShowInviteModal(true)}
              disabled={actionLoading}
              type="button"
            >
              <UserPlus
                size={16}
                style={{
                  marginRight: "calc(5px * var(--bsm-spacing-scale))",
                }}
              />{" "}
              Invite User
            </button>
          )}
        </div>
      </div>

      {loading && users.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: "calc(40px * var(--bsm-spacing-scale))",
          }}
        >
          <div className="spinner"></div> Loading users...
        </div>
      ) : (
        <div className="table-responsive-wrapper">
          <table
            className="server-table"
            style={{
              width: "100%",
            }}
          >
            <thead>
              <tr>
                <th>Username</th>
                <th>Role</th>
                <th>Status</th>
                <th
                  style={{
                    width: "150px",
                  }}
                >
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr
                  key={user.id}
                  style={{
                    opacity: user.is_active ? 1 : 0.6,
                  }}
                >
                  <td>
                    <span
                      style={{
                        fontWeight: "bold",
                      }}
                    >
                      {user.username}
                    </span>
                    {currentUser && currentUser.id === user.id && (
                      <span
                        style={{
                          marginLeft: "calc(5px * var(--bsm-spacing-scale))",
                          fontSize: "0.8em",
                          color: "var(--primary-color)",
                        }}
                      >
                        (You)
                      </span>
                    )}
                  </td>
                  <td>
                    <span className={`badge badge-${user.role}`}>
                      <Shield
                        size={12}
                        style={{
                          marginRight: "calc(4px * var(--bsm-spacing-scale))",
                        }}
                      />{" "}
                      {user.role}
                    </span>
                  </td>
                  <td>
                    {user.is_active ? (
                      <span
                        className="status-indicator status-running"
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "calc(5px * var(--bsm-spacing-scale))",
                        }}
                      >
                        <Check size={14} /> Active
                      </span>
                    ) : (
                      <span
                        className="status-indicator status-stopped"
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "calc(5px * var(--bsm-spacing-scale))",
                        }}
                      >
                        <Ban size={14} /> Disabled
                      </span>
                    )}
                  </td>
                  <td>
                    <div
                      style={{
                        display: "flex",
                        gap: "calc(5px * var(--bsm-spacing-scale))",
                      }}
                    >
                      {isAdmin && (
                        <>
                          <button
                            className="action-button secondary"
                            onClick={() => openEditModal(user)}
                            title="Edit User"
                            style={{
                              padding:
                                "calc(5px * var(--bsm-spacing-scale)) calc(10px * var(--bsm-spacing-scale))",
                            }}
                            disabled={
                              actionLoading || user.id === currentUser?.id
                            }
                            type="button"
                            aria-label="Edit User"
                          >
                            <UserCog size={14} />
                          </button>
                          <button
                            className="action-button danger-button"
                            onClick={() => handleDelete(user)}
                            title="Delete User"
                            style={{
                              padding:
                                "calc(5px * var(--bsm-spacing-scale)) calc(10px * var(--bsm-spacing-scale))",
                            }}
                            disabled={
                              actionLoading || user.id === currentUser?.id
                            }
                            type="button"
                            aria-label="Delete User"
                          >
                            <Trash2 size={14} />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td
                    colSpan="4"
                    style={{
                      textAlign: "center",
                      padding: "calc(20px * var(--bsm-spacing-scale))",
                      fontStyle: "italic",
                      color: "var(--text-color-secondary)",
                    }}
                  >
                    No users found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Invite Modal */}
      {showInviteModal && (
        <Modal
          title={<>Invite New User</>}
          onClose={closeInviteModal}
          closeDisabled={actionLoading}
        >
          {!generatedLink ? (
            <form onSubmit={handleGenerateLink}>
              <div
                style={{
                  marginBottom: "calc(20px * var(--bsm-spacing-scale))",
                  textAlign: "left",
                }}
              >
                <p
                  style={{
                    marginBottom: "calc(15px * var(--bsm-spacing-scale))",
                    color: "var(--text-color-secondary)",
                    lineHeight: "1.5",
                  }}
                >
                  Generate a secure registration link to send to a new user.
                  This link will be valid for 24 hours.
                </p>
                <label
                  className="form-label"
                  style={{
                    display: "block",
                    marginBottom: "calc(5px * var(--bsm-spacing-scale))",
                  }}
                  htmlFor="users-field-1"
                >
                  Select Role
                </label>
                <select
                  className="form-input"
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  style={{
                    width: "100%",
                  }}
                  id="users-field-1"
                >
                  <option value="user">User (Read Only)</option>
                  <option value="moderator">Moderator</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div
                className="modal-actions"
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: "calc(10px * var(--bsm-spacing-scale))",
                }}
              >
                <button
                  type="button"
                  className="action-button secondary"
                  onClick={closeInviteModal}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="action-button"
                  disabled={actionLoading}
                >
                  Generate Link
                </button>
              </div>
            </form>
          ) : (
            <div
              style={{
                textAlign: "left",
              }}
            >
              <p
                style={{
                  marginBottom: "calc(10px * var(--bsm-spacing-scale))",
                  color: "var(--success-color)",
                  fontWeight: "bold",
                }}
              >
                Link generated successfully!
              </p>
              <div
                style={{
                  display: "flex",
                  gap: "calc(10px * var(--bsm-spacing-scale))",
                  marginBottom: "calc(20px * var(--bsm-spacing-scale))",
                }}
              >
                <input
                  type="text"
                  className="form-input"
                  value={generatedLink}
                  readOnly
                  style={{
                    flexGrow: 1,
                  }}
                />
                <button
                  className="action-button"
                  onClick={copyToClipboard}
                  title="Copy to clipboard"
                  type="button"
                  aria-label="Copy to clipboard"
                >
                  {copied ? <Check size={16} /> : <Copy size={16} />}
                </button>
              </div>
              <div
                className="modal-actions"
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                }}
              >
                <button
                  type="button"
                  className="action-button secondary"
                  onClick={closeInviteModal}
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </Modal>
      )}

      {/* Edit User Modal */}
      {showEditModal && editingUser && (
        <Modal
          title={<>Edit User: {editingUser.username}</>}
          onClose={() => setShowEditModal(false)}
          closeDisabled={actionLoading}
        >
          <div
            style={{
              marginBottom: "calc(20px * var(--bsm-spacing-scale))",
              textAlign: "left",
            }}
          >
            <div
              style={{
                marginBottom: "calc(15px * var(--bsm-spacing-scale))",
              }}
            >
              <label
                className="form-label"
                style={{
                  display: "block",
                  marginBottom: "calc(5px * var(--bsm-spacing-scale))",
                }}
                htmlFor="users-field-2"
              >
                Role
              </label>
              <select
                className="form-input"
                value={editRole}
                onChange={(e) => setEditRole(e.target.value)}
                style={{
                  width: "100%",
                }}
                disabled={editingUser.id === currentUser?.id || actionLoading}
                id="users-field-2"
              >
                <option value="user">User (Read Only)</option>
                <option value="moderator">Moderator</option>
                <option value="admin">Admin</option>
              </select>
            </div>

            <div>
              <label
                className="form-label"
                style={{
                  display: "block",
                  marginBottom: "calc(5px * var(--bsm-spacing-scale))",
                }}
              >
                Account Status
              </label>
              <button
                type="button"
                className={`action-button ${editActive ? "success-button" : "danger-button"}`}
                onClick={() => setEditActive(!editActive)}
                style={{
                  width: "100%",
                  justifyContent: "center",
                }}
                disabled={editingUser.id === currentUser?.id || actionLoading}
              >
                {editActive ? (
                  <>
                    <Unlock
                      size={16}
                      style={{
                        marginRight: "calc(5px * var(--bsm-spacing-scale))",
                      }}
                    />{" "}
                    Account Active
                  </>
                ) : (
                  <>
                    <Lock
                      size={16}
                      style={{
                        marginRight: "calc(5px * var(--bsm-spacing-scale))",
                      }}
                    />{" "}
                    Account Disabled
                  </>
                )}
              </button>
              <small
                style={{
                  display: "block",
                  marginTop: "calc(5px * var(--bsm-spacing-scale))",
                  color: "var(--text-color-secondary)",
                }}
              >
                {editActive ? "User can log in." : "User cannot log in."}
              </small>
            </div>
          </div>
          <div
            className="modal-actions"
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: "calc(10px * var(--bsm-spacing-scale))",
            }}
          >
            <button
              type="button"
              className="action-button secondary"
              onClick={() => {
                setShowEditModal(false);
                setEditingUser(null);
              }}
              disabled={actionLoading}
            >
              Cancel
            </button>
            <button
              type="button"
              className="action-button"
              onClick={saveUserChanges}
              disabled={actionLoading}
            >
              Save Changes
            </button>
          </div>
        </Modal>
      )}

      <style>{`
        .badge {
            display: inline-flex;
            align-items: center;
            padding: calc(2px * var(--bsm-spacing-scale)) calc(8px * var(--bsm-spacing-scale));
            border-radius: 12px;
            font-size: 0.85em;
            font-weight: 500;
        }
        .badge-admin { background-color: rgba(255, 193, 7, 0.2); color: #ffc107; border: 1px solid rgba(255, 193, 7, 0.4); }
        .badge-moderator { background-color: rgba(33, 150, 243, 0.2); color: #2196f3; border: 1px solid rgba(33, 150, 243, 0.4); }
        .badge-user { background-color: rgba(158, 158, 158, 0.2); color: #9e9e9e; border: 1px solid rgba(158, 158, 158, 0.4); }

        .modal-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.7);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
        }
        .modal-content {
            background: var(--container-background-color);
            padding: calc(25px * var(--bsm-spacing-scale));
            border-radius: 8px;
            width: 100%;
            border: 1px solid var(--border-color);
            box-shadow: 0 4px 15px rgba(0,0,0,0.5);
            text-align: center;
        }
        .success-button {
            background-color: var(--success-color);
            color: white;
            border: none;
        }
        .success-button:hover {
            background-color: #45a049;
        }
      `}</style>
    </div>
  );
};
export default Users;
