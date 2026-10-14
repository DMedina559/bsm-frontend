import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useServer } from "../contexts/ServerContext";
import {
  usePluginPage,
  usePluginSubscriptions,
} from "../features/plugins/usePluginPage";
import { usePluginActions } from "../features/plugins/usePluginActions";
import PluginRenderer from "../features/plugins/PluginRenderer";
import "../styles/plugin-page.css";

export default function DynamicPage({ schemaJson }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const { selectedServer } = useServer();
  const query = usePluginPage({
    url: searchParams.get("url"),
    parameters: searchParams.toString(),
    server: selectedServer,
    inline: schemaJson,
  });
  const [formState, setFormState] = useState({});
  const [activeModalId, setActiveModalId] = useState(null);
  useEffect(() => {
    setFormState({});
    setActiveModalId(null);
  }, [query.scope, schemaJson]);
  const socketData = usePluginSubscriptions(
    query.schema,
    selectedServer,
    query.scope,
  );
  const handleAction = usePluginActions({
    scope: query.scope,
    formState,
    query,
    searchParams,
    setSearchParams,
    setActiveModalId,
  });
  const handleInputChange = (id, value) =>
    setFormState((previous) => ({ ...previous, [id]: value }));
  if (query.loading) return <div className="container">Loading...</div>;
  if (query.error)
    return (
      <div className="container">
        <div className="message error">Error: {query.error}</div>
      </div>
    );
  if (!query.schema) return <div className="container">No schema loaded.</div>;
  return (
    <div className="dynamic-page-wrapper">
      <PluginRenderer
        schema={query.schema}
        selectedServer={selectedServer}
        socketData={socketData}
        formState={formState}
        handleAction={handleAction}
        handleInputChange={handleInputChange}
        activeModalId={activeModalId}
        setActiveModalId={setActiveModalId}
      />
    </div>
  );
}
