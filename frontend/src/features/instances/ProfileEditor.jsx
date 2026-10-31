import React, { useState } from "react";
import { updateInstance, readInstances } from "../../app/instanceProfiles";
import { useDialog } from "../../contexts/DialogContext";
import ConnectionProbe from "./ConnectionProbe";

export default function ProfileEditor({ profile, disabled }) {
  const [draft, setDraft] = useState({
    name: profile.name,
    url: profile.url,
    group: profile.group ?? "",
    color: profile.color ?? "#00d6a0",
    titleInTab: !!profile.titleInTab,
  });
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const { confirmAction } = useDialog();
  async function save(event) {
    event.preventDefault();
    setError("");
    setSaved(false);
    if (
      draft.url.trim().replace(/\/+$/, "") !== profile.url &&
      !(await confirmAction(
        `Change ${profile.name} to ${draft.url}? This disconnects the old connection and forgets its login. Sign in separately to the new address.`,
      ))
    )
      return;
    try {
      if (
        readInstances().find((value) => value.id === profile.id)?.url !==
        profile.url
      )
        throw new Error(
          "This profile changed in another tab. Review its current address before saving again.",
        );
      updateInstance(profile.id, draft);
      setSaved(true);
    } catch (failure) {
      setError(failure.message);
    }
  }
  const field = (name) => ({
    value: draft[name],
    onChange: (event) => {
      setSaved(false);
      setDraft({ ...draft, [name]: event.target.value });
    },
  });
  return (
    <form className="instance-editor" onSubmit={save}>
      <fieldset disabled={disabled}>
        {disabled && (
          <p>
            Finish or reconcile the pending action before editing this profile.
          </p>
        )}
        <label>
          Display name
          <input required maxLength={80} {...field("name")} />
        </label>
        <label>
          Backend URL
          <input required type="url" {...field("url")} />
        </label>
        {draft.url !== profile.url && (
          <ConnectionProbe key={draft.url} url={draft.url} />
        )}
        <label>
          Group
          <input
            maxLength={60}
            placeholder="Home, testing, production…"
            {...field("group")}
          />
        </label>
        <label>
          Instance color
          <input type="color" {...field("color")} />
        </label>
        <label className="instance-checkbox">
          <input
            type="checkbox"
            checked={draft.titleInTab}
            onChange={(event) =>
              setDraft({ ...draft, titleInTab: event.target.checked })
            }
          />
          Show instance name in workspace tab title
        </label>
        {error && (
          <p className="instance-error" role="alert">
            {error}
          </p>
        )}
        {saved && <p role="status">Profile saved.</p>}
        <button className="instance-button" type="submit">
          Save profile
        </button>
      </fieldset>
    </form>
  );
}
