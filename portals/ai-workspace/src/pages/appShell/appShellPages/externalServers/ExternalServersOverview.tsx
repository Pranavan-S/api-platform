/*
 * Copyright (c) 2026, WSO2 LLC. (https://www.wso2.com).
 *
 * WSO2 LLC. licenses this file to you under the Apache License,
 * Version 2.0 (the "License"); you may not use this file except
 * in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom';
import {
  Avatar,
  Box,
  Button,
  Card,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  FormControl,
  FormLabel,
  Grid,
  IconButton,
  InputAdornment,
  MenuItem,
  PageContent,
  Select,
  Skeleton,
  Stack,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from '@wso2/oxygen-ui';
import {
  ChevronLeft,
  Clock,
  Copy,
  Check,
  Edit,
  Eye,
  EyeOff,
  Info,
  Megaphone,
  Plus,
  Rocket,
  Trash2,
} from '@wso2/oxygen-ui-icons-react';
import { FormattedMessage } from 'react-intl';
import { useAppShell } from '../../../../contexts/AppShellContext';
import { formatRelativeTime } from '../../../../contexts/llmProvider';
import {
  buildProjectPath,
  getProjectSlug,
} from '../../../../utils/projectRouting';
import { PLATFORM_API_BASE_URL } from '../../../../paths';
import { API_PORTAL_ENABLED } from '../../../../config.env';
import { mcpProxiesApis } from '../../../../apis/MCP/mcpProxiesApis';
import * as mcpServerValidationApis from '../../../../apis/MCP/mcpServerValidationApis';
import {
  createSecret,
  deleteSecret,
  buildSecretPlaceholder,
  generateSecretHandle,
  extractSecretHandle,
} from '../../../../apis/secretApis';
import { getGuardrails } from '../../../../apis/policyHubApis';
import { getMCPServerDeployments } from '../../../../apis/MCP/mcpServerDeployApis';
import useAIWorkspaceSnackbar from '../../../../hooks/aiWorkspaceSnackbar';
import { logger } from '../../../../utils/logger';
import { getErrorMessage } from '../../../../utils/apiError';
import { parseMCPServerCapabilities } from '../../../../utils/mcpCapabilities';
import type {
  MCPServer,
  MCPServerCapabilities,
  MCPServerInfoFetchRequest,
  MCPServerInfoFetchResponse,
} from '../../../../utils/types';
import type { ParameterValues } from '../../PolicyParameterEditor/types';
import PolicyMapper from './PolicyMapper';
import type { SelectedPolicy } from './PolicyMapper';
import ExternalServersValidationDetails from './ExternalServersValidationDetails';
import CapabilitiesDrawer from './CapabilitiesDrawer';
import OverviewLifecycleStage from './OverviewLifecycleStage';
import type { EndpointValidationResponse } from './externalServersValidationTypes';
import { isListedOnPortal } from '../publish/publicationDisplay';
import { usePublishProject } from '../../../../hooks/usePublishProject';
import { useMcpDeployedGateways } from '../../../../hooks/useMcpDeployedGateways';
import { buildMcpInvokeUrl } from '../../../../utils/mcpInvokeUrl';
import ExternalServerStepBanner from '../quickStart/ExternalServerStepBanner';
import type { ExternalServerStepBannerStepId } from '../quickStart/ExternalServerStepBanner';
import {
  DisabledActionTooltip,
  GatewayArtifactDeleteWarning,
  GatewayArtifactReadOnlyBanner,
} from '../../../../utils/readOnlyArtifacts';
import {
  activeDeploymentDeleteBlockedReason,
  countActiveDeployments,
} from '../../../../utils/artifactDeletion';
import { useAppAuth } from '../../../../contexts/AppAuthContext';
import {
  DISABLED_ACTION_SX,
  NO_PERMISSION_TOOLTIP,
  SCOPES,
} from '../../../../auth/permissions';

function getInitials(name: string): string {
  const words = name.trim().split(/\s+/);
  if (words.length === 0) return '';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0]}${words[1][0]}`.toUpperCase();
}

function isNonArrayObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// Normalizes possibly-undefined capability arrays to `[]` so a stored server's
// capabilities and a freshly refetched result can be compared like-for-like.
function normalizeCapabilities(
  capabilities: MCPServerCapabilities | undefined
): MCPServerCapabilities {
  return {
    tools: capabilities?.tools ?? [],
    resources: capabilities?.resources ?? [],
    prompts: capabilities?.prompts ?? [],
  };
}

function pruneEmptyPolicyParamValues(value: unknown): unknown {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed === '' ? undefined : trimmed;
  }

  if (Array.isArray(value)) {
    const cleaned = value
      .map((item) => pruneEmptyPolicyParamValues(item))
      .filter((item) => {
        if (item === undefined || item === null) return false;
        if (typeof item === 'string') return item.trim() !== '';
        if (Array.isArray(item)) return item.length > 0;
        if (isNonArrayObject(item)) return Object.keys(item).length > 0;
        return true;
      });

    return cleaned.length > 0 ? cleaned : undefined;
  }

  if (isNonArrayObject(value)) {
    const cleaned = Object.entries(value).reduce<Record<string, unknown>>(
      (acc, [key, rawValue]) => {
        const normalizedValue = pruneEmptyPolicyParamValues(rawValue);

        if (normalizedValue === undefined || normalizedValue === null) {
          return acc;
        }
        if (
          typeof normalizedValue === 'string' &&
          normalizedValue.trim() === ''
        ) {
          return acc;
        }
        if (Array.isArray(normalizedValue) && normalizedValue.length === 0) {
          return acc;
        }
        if (
          isNonArrayObject(normalizedValue) &&
          Object.keys(normalizedValue).length === 0
        ) {
          return acc;
        }

        acc[key] = normalizedValue;
        return acc;
      },
      {}
    );

    return Object.keys(cleaned).length > 0 ? cleaned : undefined;
  }

  return value;
}

type TabPanelProps = {
  children: React.ReactNode;
  value: number;
  index: number;
};

function TabPanel({ children, value, index }: TabPanelProps): JSX.Element {
  return (
    <Box role="tabpanel" hidden={value !== index}>
      {value === index ? children : null}
    </Box>
  );
}

const TAB_LABELS = ['Overview', 'Policies', 'Backend Connection'];
const UNSAVED_CHANGES_MESSAGE =
  'You have unsaved changes. Please save or cancel before leaving this page.';
// Sentinel shown in the auth header Value field in place of the real (write-only,
// never-returned-by-the-API) secret value. Matches the convention already used for
// LLM Provider credentials (ServiceProviderConnectionTab.tsx).
const MASKED_CREDENTIAL_VALUE = '******';

export default function ExternalServersOverview(): JSX.Element {
  const { serverId, projectSlug } = useParams<{
    serverId: string;
    projectSlug: string;
  }>();
  const {
    currentOrganization,
    currentProject,
    projectsForCurrentOrganization,
  } = useAppShell();
  const routeProject = useMemo(
    () =>
      projectsForCurrentOrganization.find(
        (project) => getProjectSlug(project) === projectSlug
      ) ?? null,
    [projectSlug, projectsForCurrentOrganization]
  );
  const effectiveProject = routeProject ?? currentProject;
  const organizationId = currentOrganization?.uuid ?? '';
  const apimBaseUrl = PLATFORM_API_BASE_URL;
  const listPath = buildProjectPath(
    currentOrganization,
    effectiveProject,
    '/mcp-proxy'
  );

  const navigate = useNavigate();
  const { publishPath } = usePublishProject();
  const publishUrl = publishPath(`/${encodeURIComponent(serverId ?? '')}`);
  const showSnackbar = useAIWorkspaceSnackbar();
  const { hasPermission } = useAppAuth();
  const canDeleteMcpProxy = hasPermission(SCOPES.MCP_PROXY_DELETE);
  const canDeployMcpProxy = hasPermission(SCOPES.MCP_PROXY_DEPLOYMENT_CREATE);
  const canViewDeployments = hasPermission(SCOPES.MCP_PROXY_DEPLOYMENT_READ);
  const canOpenPublishPage =
    hasPermission(SCOPES.MCP_PROXY_API_PORTAL_PUBLISH) ||
    hasPermission(SCOPES.MCP_PROXY_API_PORTAL_UNPUBLISH) ||
    hasPermission(SCOPES.MCP_PROXY_API_PORTAL_MANAGE);
  const [server, setServer] = useState<MCPServer | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingChanges, setIsSavingChanges] = useState(false);
  const { gateways: deployedGateways, isLoading: isGatewaysLoading } =
    useMcpDeployedGateways(organizationId, serverId ?? '');
  const [selectedGatewayId, setSelectedGatewayId] = useState('');
  const [tabIndex, setTabIndex] = useState(0);
  const [selectedPolicies, setSelectedPolicies] = useState<SelectedPolicy[]>(
    []
  );
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [activeDeploymentCount, setActiveDeploymentCount] = useState<number | null>(null);
  const isReadOnlyServer = Boolean(server?.readOnly);

  // Whether this proxy is listed on any MCP Hub. null until known, and when the
  // lookup fails: that leaves the Publish action available rather than guessing.
  const [isPublished, setIsPublished] = useState<boolean | null>(null);
  const [isPublishStatusLoading, setIsPublishStatusLoading] = useState(false);
  const [isContextCopied, setIsContextCopied] = useState(false);

  // Backend Connection tab
  const [endpointUrl, setEndpointUrl] = useState('');
  const [authHeaderName, setAuthHeaderName] = useState('');
  const [authHeaderValue, setAuthHeaderValue] = useState('');
  const [showAuthHeaderValue, setShowAuthHeaderValue] = useState(false);
  const [isCredentialMasked, setIsCredentialMasked] = useState(false);
  const [hasCredentialChanged, setHasCredentialChanged] = useState(false);
  const [isRefetching, setIsRefetching] = useState(false);
  // Staged tools/resources/prompts from the last successful Refetch Server Info,
  // pending Save. Cleared whenever `server` is (re)loaded — including right after a
  // successful save, since the newly saved server's own capabilities are then current.
  const [refetchedCapabilities, setRefetchedCapabilities] =
    useState<MCPServerCapabilities | null>(null);
  // MCP protocol versions the upstream reported on the last successful Refetch Server
  // Info, staged pending Save (mirrors refetchedCapabilities).
  const [refetchedSupportedVersions, setRefetchedSupportedVersions] =
    useState<string[] | undefined>(undefined);
  // Name and version the upstream reported for itself on that same refetch. Display
  // only — nothing persists it, so it is the proxy's own fields that would otherwise
  // stand in for it, and those describe the proxy rather than the server.
  const [refetchedServerInfo, setRefetchedServerInfo] =
    useState<MCPServerInfoFetchResponse['serverInfo'] | null>(null);
  const [isCapabilitiesDrawerOpen, setIsCapabilitiesDrawerOpen] =
    useState(false);

  const selectedPoliciesRef = useRef<SelectedPolicy[]>([]);
  const [initialPolicies, setInitialPolicies] = useState<SelectedPolicy[]>([]);

  const updateSelectedPolicies = useCallback(
    (updater: React.SetStateAction<SelectedPolicy[]>) => {
      setSelectedPolicies((prev) => {
        const next =
          typeof updater === 'function'
            ? (updater as (prevState: SelectedPolicy[]) => SelectedPolicy[])(
                prev
              )
            : updater;
        selectedPoliciesRef.current = next;
        return next;
      });
    },
    []
  );

  useEffect(() => {
    if (!serverId || !organizationId) return;
    let cancelled = false;
    const fetchServer = async () => {
      try {
        setIsLoading(true);
        const response = await mcpProxiesApis.getMCPServer(
          serverId,
          apimBaseUrl
        );
        if (!cancelled) {
          setServer(response);
        }
      } catch {
        // silently fail
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };
    fetchServer();
    return () => {
      cancelled = true;
    };
  }, [serverId, organizationId, apimBaseUrl]);

  // Keep the chosen gateway while it is still deployed, otherwise fall back to the newest.
  useEffect(() => {
    setSelectedGatewayId((current) =>
      deployedGateways.some((gateway) => gateway.id === current)
        ? current
        : (deployedGateways[0]?.id ?? '')
    );
  }, [deployedGateways]);

  useEffect(() => {
    if (!organizationId || !serverId || !isReadOnlyServer || !canDeleteMcpProxy) {
      setActiveDeploymentCount(null);
      return;
    }

    let isCancelled = false;

    const resolveActiveDeployments = async () => {
      const deployments = await getMCPServerDeployments(serverId, apimBaseUrl);

      if (isCancelled) return;

      setActiveDeploymentCount(countActiveDeployments(deployments.list));
    };

    resolveActiveDeployments().catch((err) => {
      logger.error(
        'Failed to resolve MCP Proxy deployments for delete guard:',
        err
      );
      if (isCancelled) return;
      setActiveDeploymentCount(null);
    });

    return () => {
      isCancelled = true;
    };
  }, [organizationId, serverId, isReadOnlyServer, canDeleteMcpProxy, apimBaseUrl]);

  const deleteBlockedReason = useMemo(() => {
    if (!isReadOnlyServer || activeDeploymentCount === null || activeDeploymentCount === 0) {
      return null;
    }
    return activeDeploymentDeleteBlockedReason(
      'MCP Proxy',
      activeDeploymentCount
    );
  }, [isReadOnlyServer, activeDeploymentCount]);

  const handleDeleteConfirm = async () => {
    if (!server || !serverId || isDeleting) return;
    try {
      setIsDeleting(true);
      await mcpProxiesApis.deleteMCPServer(serverId, apimBaseUrl);
      showSnackbar('MCP Proxy deleted successfully.', 'success');
      setIsDeleteDialogOpen(false);
      navigate(listPath, { replace: true });
    } catch (err) {
      showSnackbar(getErrorMessage(err, 'Failed to delete MCP Proxy.'), 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const generatedInvokeUrl = useMemo(
    () =>
      buildMcpInvokeUrl(
        deployedGateways.find((gateway) => gateway.id === selectedGatewayId),
        server?.context
      ),
    [deployedGateways, selectedGatewayId, server?.context]
  );

  // Resolves true when the text reached the clipboard through the async API; the
  // textarea fallback for older browsers copies silently.
  const copyText = async (text: string): Promise<boolean> => {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      return false;
    }
  };

  const handleCopyInvokeUrl = async () => {
    if (generatedInvokeUrl && (await copyText(generatedInvokeUrl))) {
      showSnackbar('URL copied to clipboard.', 'success');
    }
  };

  const handleCopyContext = async () => {
    if (!(await copyText(server?.context || '/'))) return;
    setIsContextCopied(true);
    window.setTimeout(() => setIsContextCopied(false), 1500);
  };

  // Convert server.policies -> SelectedPolicy[] on load
  useEffect(() => {
    if (!server) return;
    const policies = (server.policies ?? []) as Array<{
      name: string;
      version: string;
      params?: Record<string, unknown>;
    }>;

    const mapPolicies = async () => {
      let guardrailPolicies: Array<{ name: string; displayName?: string }> = [];
      try {
        const response = await getGuardrails('MCP');
        guardrailPolicies = response.data ?? [];
      } catch {
        logger.error('Failed to fetch guardrail policies for display names');
      }

      const mapped: SelectedPolicy[] = policies.map((policy, index) => {
        const guardrail = guardrailPolicies.find((g) => g.name === policy.name);
        return {
          instanceId: `${policy.name}-${policy.version}-${index}-${Date.now()}`,
          policyId: policy.name,
          policyName: policy.name,
          displayName: guardrail?.displayName || policy.name,
          version: policy.version,
          params: policy.params ?? {},
        };
      });
      updateSelectedPolicies(mapped);
      setInitialPolicies(mapped);
    };

    void mapPolicies();
  }, [server, updateSelectedPolicies]);

  // Populate the Backend Connection fields from the last-saved server config.
  // Reruns after a successful save (setServer(updated)), so the fields always diff
  // against the current persisted state rather than a snapshot taken once on mount.
  useEffect(() => {
    if (!server) return;
    setEndpointUrl(server.upstream?.main?.url ?? '');
    setAuthHeaderName(server.upstream?.main?.auth?.header ?? '');
    // auth.value is write-only and never returned by GET — auth.header is the only
    // signal the API gives us that a credential is already configured for this proxy.
    const hasExistingAuth = Boolean(server.upstream?.main?.auth?.header);
    setAuthHeaderValue(hasExistingAuth ? MASKED_CREDENTIAL_VALUE : '');
    setIsCredentialMasked(hasExistingAuth);
    setHasCredentialChanged(false);
    setRefetchedCapabilities(null);
    setRefetchedSupportedVersions(undefined);
    setRefetchedServerInfo(null);
  }, [server]);

  const hasPolicyChanges = useMemo(() => {
    if (selectedPolicies.length !== initialPolicies.length) return true;
    return selectedPolicies.some(
      (p, i) =>
        p.policyId !== initialPolicies[i]?.policyId ||
        p.version !== initialPolicies[i]?.version ||
        JSON.stringify(p.params) !== JSON.stringify(initialPolicies[i]?.params)
    );
  }, [selectedPolicies, initialPolicies]);

  const hasBackendConnectionChanges = useMemo(() => {
    if (!server) return false;
    const savedUrl = server.upstream?.main?.url ?? '';
    const savedHeaderName = server.upstream?.main?.auth?.header ?? '';
    if (endpointUrl.trim() !== savedUrl.trim()) return true;
    if (authHeaderName.trim() !== savedHeaderName.trim()) return true;
    // The saved credential value is write-only and never returned by the API, so the
    // only way to know it changed is that the user unmasked the field and typed in it.
    if (!isCredentialMasked && hasCredentialChanged) return true;
    return false;
  }, [
    server,
    endpointUrl,
    authHeaderName,
    isCredentialMasked,
    hasCredentialChanged,
  ]);

  // A staged refetch only actually counts as a change if it discovered something
  // different from what's currently stored — an unedited refetch that finds the
  // exact same tools/resources/prompts shouldn't flip Save on for no reason.
  const hasCapabilitiesChanges = useMemo(() => {
    if (!refetchedCapabilities) return false;
    return (
      JSON.stringify(refetchedCapabilities) !==
      JSON.stringify(normalizeCapabilities(server?.capabilities))
    );
  }, [refetchedCapabilities, server]);

  // Its own term rather than part of hasCapabilitiesChanges: a refetch can report a
  // version set the proxy has not recorded while the tools, resources and prompts are
  // unchanged, and that is still something to save.
  const hasUpstreamVersionsChanges = useMemo(() => {
    // An empty result counts as a change, not as "nothing learnt". Every path in the API
    // that cannot determine the versions returns an error, so a successful response
    // carrying none means the server named none — a fact about whatever this endpoint now
    // points at. Treating it as no-change left the previous server's versions recorded
    // against a backend that does not report them.
    if (!refetchedSupportedVersions) return false;
    return (
      JSON.stringify(refetchedSupportedVersions) !==
      JSON.stringify(server?.upstreamMcpSpecVersions ?? [])
    );
  }, [refetchedSupportedVersions, server]);

  const hasUnsavedChanges =
    hasPolicyChanges ||
    hasBackendConnectionChanges ||
    hasCapabilitiesChanges ||
    hasUpstreamVersionsChanges;

  const handleCancelChanges = () => {
    if (isReadOnlyServer) return;
    updateSelectedPolicies(initialPolicies);
    if (server) {
      setEndpointUrl(server.upstream?.main?.url ?? '');
      setAuthHeaderName(server.upstream?.main?.auth?.header ?? '');
      const hasExistingAuth = Boolean(server.upstream?.main?.auth?.header);
      setAuthHeaderValue(hasExistingAuth ? MASKED_CREDENTIAL_VALUE : '');
      setIsCredentialMasked(hasExistingAuth);
      setHasCredentialChanged(false);
    }
    setRefetchedCapabilities(null);
    setRefetchedSupportedVersions(undefined);
    setRefetchedServerInfo(null);
  };

  const handleSaveChanges = async () => {
    if (!server || !organizationId || isReadOnlyServer) return;
    const orderedPolicies = selectedPoliciesRef.current;

    // Convert selectedPolicies -> flat policy payload (preserve current UI order)
    const policiesPayload = orderedPolicies.map((sp) => {
      const normalizedParams = pruneEmptyPolicyParamValues(sp.params);

      return {
        name: sp.policyName,
        version: sp.version,
        ...(isNonArrayObject(normalizedParams)
          ? { params: normalizedParams }
          : {}),
      };
    });

    const { createdAt, createdBy, updatedAt, updatedBy, ...updatePayload } = server;

    // Rotating the credential (only when it was actually unmasked and edited): create a
    // new secret up front so the update payload never carries plaintext, then best-effort
    // delete the old secret once the update succeeds. Mirrors MCPServerProvider.updateMCPServer.
    const isRotatingCredential = !isCredentialMasked && hasCredentialChanged;
    let upstreamPayload = server.upstream;
    // Tracks the handle created below (rotation flow only), so a subsequent failed
    // updateMCPServer call can clean it up instead of leaking an orphaned secret.
    let newlyCreatedSecretHandle: string | null = null;

    if (hasBackendConnectionChanges) {
      const trimmedUrl = endpointUrl.trim();
      const trimmedHeaderName = authHeaderName.trim();
      let authPayload = server.upstream?.main?.auth;

      if (isRotatingCredential) {
        const trimmedValue = authHeaderValue.trim();
        if (trimmedHeaderName && trimmedValue) {
          try {
            const secretHandle = generateSecretHandle();
            const secretResponse = await createSecret({
              id: secretHandle,
              displayName: `${server.displayName} upstream auth`,
              description: `Auto-generated secret for MCP server ${server.displayName}`,
              value: trimmedValue,
              type: 'GENERIC',
            });
            newlyCreatedSecretHandle = secretResponse.id;
            authPayload = {
              type: 'header',
              header: trimmedHeaderName,
              value: buildSecretPlaceholder(secretResponse.id),
            };
          } catch {
            showSnackbar('Failed to encrypt upstream auth credential', 'error');
            return;
          }
        } else {
          // Rotated to an empty header/value — the user is explicitly clearing auth.
          authPayload = undefined;
        }
      } else if (trimmedHeaderName) {
        // Not rotating: preserve the existing credential. auth.value is writeOnly and
        // never present on the cached server object, so omitting it here (rather than
        // reconstructing it) relies on the backend's preserveMCPUpstreamAuthValue to
        // keep the stored value — the same fallback the Policies-only save path
        // already depends on. Only the header name (URL-only/header-only edits) changes.
        authPayload = { ...server.upstream?.main?.auth, type: 'header', header: trimmedHeaderName };
      } else {
        // Header name cleared — no credential to attach, so drop auth entirely.
        authPayload = undefined;
      }

      upstreamPayload = {
        main: {
          ...server.upstream?.main,
          url: trimmedUrl,
          auth: authPayload,
        },
      };
    }

    // A staged refetch result (if any, and if it actually differs from what's
    // stored) replaces the proxy's capabilities; otherwise the existing stored
    // capabilities are resent as-is, same as before this field was ever staged.
    const capabilitiesPayload = hasCapabilitiesChanges
      ? (refetchedCapabilities ?? undefined)
      : updatePayload.capabilities;

    // Same rule as capabilities: a staged refetch replaces the recorded set, otherwise
    // the stored one is resent. Resending matters — the API's update is a full replace,
    // so omitting this would clear what the proxy already recorded.
    const upstreamVersionsPayload = hasUpstreamVersionsChanges
      ? refetchedSupportedVersions
      : updatePayload.upstreamMcpSpecVersions;

    try {
      setIsSavingChanges(true);
      const updated = await mcpProxiesApis.updateMCPServer(
        server.id,
        {
          ...updatePayload,
          policies: policiesPayload,
          upstream: upstreamPayload,
          capabilities: capabilitiesPayload,
          upstreamMcpSpecVersions: upstreamVersionsPayload,
        },
        apimBaseUrl
      );
      setServer(updated);

      if (hasBackendConnectionChanges && isRotatingCredential) {
        const oldHandle = server.upstream?.main?.auth?.value
          ? extractSecretHandle(server.upstream.main.auth.value)
          : null;
        if (oldHandle) {
          deleteSecret(oldHandle).catch((err) => {
            logger.warn('Could not delete old secret after MCP proxy update', err);
          });
        }
      }

      showSnackbar('Changes saved successfully.', 'success');
    } catch {
      // The MCP proxy update failed after a new secret was already created for the
      // rotation — clean it up (best-effort) so it doesn't leak as an orphaned,
      // unreferenced credential. Only the newly created handle, never the old one.
      if (newlyCreatedSecretHandle) {
        deleteSecret(newlyCreatedSecretHandle).catch((err) => {
          logger.warn('Could not clean up newly created secret after failed MCP proxy update', err);
        });
      }
      showSnackbar('Failed to save changes.', 'error');
    } finally {
      setIsSavingChanges(false);
    }
  };

  const handleRefetch = async () => {
    if (!server) return;
    const trimmedUrl = endpointUrl.trim();
    if (!trimmedUrl) {
      showSnackbar('Enter an endpoint URL before refetching.', 'error');
      return;
    }

    const trimmedHeaderName = authHeaderName.trim();
    const storedHeaderName = (server.upstream?.main?.auth?.header ?? '').trim();
    const endpointUnchanged =
      trimmedUrl === (server.upstream?.main?.url ?? '').trim();
    const headerNameUnchanged = trimmedHeaderName === storedHeaderName;

    setIsRefetching(true);
    try {
      // Which credential the fetch runs with is what picks the request shape. A live
      // value the user just typed goes on the wire directly; otherwise the credential
      // is write-only (masked as ******) and only the backend can resolve it, which it
      // does from proxyId. auth never accompanies proxyId — whenever a proxy is
      // referenced, its stored auth is authoritative and an override is rejected.
      let request: MCPServerInfoFetchRequest;
      if (trimmedHeaderName && !isCredentialMasked && authHeaderValue.trim()) {
        // A new or rotated credential was typed — validate the endpoint against it
        // directly, before anything is saved.
        request = {
          url: trimmedUrl,
          auth: {
            type: 'header',
            header: trimmedHeaderName,
            value: authHeaderValue.trim(),
          },
        };
      } else if (!trimmedHeaderName) {
        // No auth header configured, or the user is clearing it — validate the way the
        // saved proxy would actually behave, unauthenticated.
        request = { url: trimmedUrl };
      } else if (!headerNameUnchanged) {
        // The header was renamed but the value is still masked. proxyId would resolve
        // the stored header name too, so there is no shape that pairs the new name with
        // the stored value — the user has to supply one or the other.
        showSnackbar(
          'Enter the authentication header value, or save your changes first, to refetch with the renamed header.',
          'error'
        );
        return;
      } else if (endpointUnchanged) {
        // Nothing to override — the backend resolves both the stored URL and the stored
        // credential from the persisted config.
        request = { proxyId: server.id };
      } else {
        // The endpoint was edited but the credential was not. Send both: the backend
        // fetches the unsaved URL using the stored secret, so the user can verify an
        // endpoint change without re-entering a credential they can never read back.
        request = { url: trimmedUrl, proxyId: server.id };
      }

      const response = await mcpServerValidationApis.fetchMCPProxyServerInfo(
        request,
        apimBaseUrl
      );
      // Stage the discovered tools/resources/prompts so the user can Save them —
      // the fetch-server-info response already uses the same MCPServerTool/
      // MCPServerResource/MCPServerPrompt shapes as MCPServerCapabilities, so no
      // remapping is needed here (unlike the creation flow's EndpointValidationResponse).
      const discoveredCapabilities = {
        tools: response.tools ?? [],
        resources: response.resources ?? [],
        prompts: response.prompts ?? [],
      };
      setRefetchedCapabilities(discoveredCapabilities);
      // Coerced so the display can tell "the probe found none" from "no probe ran" — the
      // API omits the field in both cases, and only this side knows one happened.
      const discoveredVersions = response.supportedVersions ?? [];
      setRefetchedSupportedVersions(discoveredVersions);
      // A server may omit its own identity, so this is optional in practice whatever the
      // response type says.
      setRefetchedServerInfo(response.serverInfo ?? null);
      // Only prompt to Save when the refetch actually found something different — the
      // hasCapabilitiesChanges/hasUpstreamVersionsChanges memos won't reflect the state
      // just set above until the next render, so this mirrors both comparisons directly
      // against the response.
      const capabilitiesChanged =
        JSON.stringify(discoveredCapabilities) !==
        JSON.stringify(normalizeCapabilities(server.capabilities));
      const versionsChanged =
        JSON.stringify(discoveredVersions) !==
        JSON.stringify(server.upstreamMcpSpecVersions ?? []);
      // Counted alongside the capabilities: a version set changing is the one discovery
      // the other counts cannot show, so without it the message offers Save while every
      // number in it appears unchanged. The card below lists which versions they are.
      //
      // Dropped entirely at zero, unlike the capability counts. A legacy server naming no
      // version is ordinary, so "0 MCP versions found" would read as a failure; an empty
      // tool list is worth stating.
      const versionsTerm =
        discoveredVersions.length > 0
          ? `, ${discoveredVersions.length} MCP versions`
          : '';
      showSnackbar(
        `Connection verified — ${discoveredCapabilities.tools.length} tools, ${discoveredCapabilities.resources.length} resources, ${discoveredCapabilities.prompts.length} prompts${versionsTerm} found.` +
          (capabilitiesChanged || versionsChanged
            ? ' Click Save to update what the proxy has recorded about this server.'
            : ''),
        'success'
      );
    } catch (err) {
      showSnackbar(getErrorMessage(err, 'Failed to fetch server info'), 'error');
    } finally {
      setIsRefetching(false);
    }
  };

  // What the drawer opens with: the currently staged (refetched/manually-edited)
  // capabilities if there are any, otherwise the server's last-saved capabilities.
  const capabilitiesDrawerInitialValue = useMemo(
    () =>
      JSON.stringify(
        refetchedCapabilities ?? normalizeCapabilities(server?.capabilities),
        null,
        2
      ),
    [refetchedCapabilities, server]
  );

  const handleOpenCapabilitiesDrawer = () => {
    if (isReadOnlyServer) return;
    setIsCapabilitiesDrawerOpen(true);
  };

  // Applying the drawer's edited JSON stages it the same way a Refetch result is
  // staged, so it flows through the existing hasCapabilitiesChanges/Save machinery
  // rather than a second, parallel capabilities-tracking mechanism.
  const handleApplyCapabilities = (value: string) => {
    try {
      const parsed = JSON.parse(value) as Record<string, unknown>;
      setRefetchedCapabilities(parseMCPServerCapabilities(parsed));
      // Anything an earlier refetch learned about the server itself is left staged: a
      // hand-edited capability list replaces the capabilities and says nothing about what
      // the server reported it is or which protocol versions it speaks. Dropping the
      // versions here also lost them silently — where a refetch had found only new
      // versions, clearing them left nothing unsaved and greyed out Save.
      setIsCapabilitiesDrawerOpen(false);
    } catch (err) {
      showSnackbar(
        getErrorMessage(err, 'Invalid JSON in capabilities editor. Fix errors before applying.'),
        'error'
      );
    }
  };

  useEffect(() => {
    if (!API_PORTAL_ENABLED || !serverId || !organizationId) return;
    let cancelled = false;
    setIsPublishStatusLoading(true);
    mcpProxiesApis
      .listMcpProxyApiPortalPublications(serverId, apimBaseUrl)
      .then((summary) => {
        if (!cancelled) {
          setIsPublished(summary.list.some(({ status }) => isListedOnPortal(status)));
        }
      })
      .catch((err) => {
        logger.error('Failed to check MCP Hub publish status', err);
        if (!cancelled) setIsPublished(null);
      })
      .finally(() => {
        if (!cancelled) setIsPublishStatusLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [serverId, organizationId, apimBaseUrl]);

  const handleStepBannerClick = (stepId: ExternalServerStepBannerStepId) => {
    if (stepId === 'add-policies') {
      setTabIndex(1);
    } else if (stepId === 'deploy-to-gateway') {
      navigate('deploy');
    } else if (stepId === 'publish-to-mcp-hub') {
      navigate(publishUrl);
    }
  };

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabIndex(newValue);
  };

  const handleBlockedNavigation = (event: React.MouseEvent<HTMLElement>) => {
    if (!hasUnsavedChanges) return;
    event.preventDefault();
    showSnackbar(UNSAVED_CHANGES_MESSAGE, 'error');
  };

  const handleAddPolicy = (policy: Omit<SelectedPolicy, 'instanceId'>) => {
    if (isReadOnlyServer) return;
    const nextItem: SelectedPolicy = {
      instanceId: `${policy.policyId}-${Date.now()}`,
      ...policy,
    };

    updateSelectedPolicies((prev) => [...prev, nextItem]);
  };

  const handleUpdatePolicy = (instanceId: string, params: ParameterValues) => {
    if (isReadOnlyServer) return;
    updateSelectedPolicies((prev) =>
      prev.map((policy) =>
        policy.instanceId === instanceId ? { ...policy, params } : policy
      )
    );
  };

  const handleRemovePolicy = (instanceId: string) => {
    if (isReadOnlyServer) return;
    updateSelectedPolicies((prev) =>
      prev.filter((policy) => policy.instanceId !== instanceId)
    );
  };

  const handleReorderPolicies = (
    draggedInstanceId: string,
    targetInstanceId: string
  ) => {
    if (isReadOnlyServer) return;
    updateSelectedPolicies((prev) => {
      const draggedIndex = prev.findIndex(
        (policy) => policy.instanceId === draggedInstanceId
      );
      const targetIndex = prev.findIndex(
        (policy) => policy.instanceId === targetInstanceId
      );

      if (draggedIndex === -1 || targetIndex === -1) {
        return prev;
      }

      const next = [...prev];
      const [movedPolicy] = next.splice(draggedIndex, 1);
      next.splice(targetIndex, 0, movedPolicy);
      return next;
    });
  };

  const validationResult: EndpointValidationResponse | null = useMemo(() => {
    if (!server?.capabilities) return null;
    return {
      endpointUrl: server.upstream?.main?.url ?? '',
      serverInfo: {
        name: server.displayName ?? '',
        version: server.version ?? '',
      },
      tools: (server.capabilities.tools ??
        []) as unknown as EndpointValidationResponse['tools'],
      resources: (server.capabilities.resources ??
        []) as unknown as EndpointValidationResponse['resources'],
      prompts: (server.capabilities.prompts ??
        []) as unknown as EndpointValidationResponse['prompts'],
    };
  }, [server]);

  // Preview of a staged (not-yet-saved) refetch result, shown in the Backend Connection
  // tab so a discovered tool/resource/prompt can be reviewed before Save.
  const refetchedValidationResult: EndpointValidationResponse | null = useMemo(() => {
    if (!refetchedCapabilities) return null;
    return {
      endpointUrl: endpointUrl.trim(),
      // What the upstream said about itself, not what this proxy is called. Falling back
      // to the proxy's own displayName and artifact version would put two unrelated
      // values under a heading that claims they came from the server.
      serverInfo: {
        name: refetchedServerInfo?.name ?? '',
        version: refetchedServerInfo?.version ?? '',
      },
      supportedVersions: refetchedSupportedVersions,
      tools: refetchedCapabilities.tools as unknown as EndpointValidationResponse['tools'],
      resources: refetchedCapabilities.resources as unknown as EndpointValidationResponse['resources'],
      prompts: refetchedCapabilities.prompts as unknown as EndpointValidationResponse['prompts'],
    };
  }, [
    refetchedCapabilities,
    refetchedSupportedVersions,
    refetchedServerInfo,
    endpointUrl,
  ]);

  const hasDeployments = deployedGateways.length > 0;
  const publicationStatusLabel = isPublishStatusLoading
    ? 'Checking…'
    : isPublished === null
      ? 'Status unavailable'
      : isPublished
        ? 'Published'
        : 'Not published';

  if (isLoading) {
    return (
      <PageContent fullWidth>
        <Stack spacing={3} sx={{ mt: 2 }}>
          <Card>
            <Box
              sx={{ display: 'flex', alignItems: 'center', gap: 2, padding: 2 }}
            >
              <Skeleton variant="circular" width={72} height={72} />
              <Stack spacing={1} sx={{ flex: 1 }}>
                <Skeleton variant="text" width="40%" height={32} />
                <Skeleton variant="text" width="60%" height={20} />
                <Skeleton variant="text" width="30%" height={16} />
              </Stack>
            </Box>
          </Card>
        </Stack>
      </PageContent>
    );
  }

  if (!server) {
    return (
      <PageContent fullWidth>
        <Stack spacing={2}>
          <Typography variant="h6">
            <FormattedMessage
              id="aiWorkspace.pages.appShell.appShellPages.externalServers.overview.notFound"
              defaultMessage="MCP Proxy not found"
            />
          </Typography>
          <Button component={RouterLink} to={listPath}>
            <FormattedMessage
              id="aiWorkspace.pages.appShell.appShellPages.externalServers.overview.backToList"
              defaultMessage="Back to external servers"
            />
          </Button>
        </Stack>
      </PageContent>
    );
  }

  return (
    <PageContent fullWidth>
      <Button
        component={RouterLink}
        to={listPath}
        size="small"
        startIcon={<ChevronLeft size={24} />}
        sx={{ px: 0, minWidth: 'auto' }}
      >
        <FormattedMessage
          id="aiWorkspace.pages.appShell.appShellPages.externalServers.overview.back"
          defaultMessage="Back to list"
        />
      </Button>

      <ExternalServerStepBanner
        serverName={server?.displayName}
        hasPolicies={(server?.policies?.length ?? 0) > 0}
        hasDeployments={hasDeployments}
        hasPublication={API_PORTAL_ENABLED ? isPublished === true : undefined}
        onStepClick={handleStepBannerClick}
      />

      <Stack spacing={3} sx={{ mt: 2, mb: 4 }}>
        {/* Top Card - Server Info and lifecycle */}
        <Card sx={{ overflow: 'hidden' }}>
          <Stack
            direction="row"
            alignItems="flex-start"
            flexWrap="wrap"
            gap={3}
            sx={{ p: 3 }}
          >
            <Avatar
              variant="rounded"
              sx={{
                width: 88,
                height: 88,
                fontWeight: 600,
                fontSize: 34,
                borderRadius: 2,
                bgcolor: 'primary.light',
                color: 'primary.contrastText',
              }}
            >
              {getInitials(server.displayName)}
            </Avatar>
            <Stack spacing={1.25} sx={{ flex: '1 1 380px', minWidth: 0 }}>
              <Stack
                direction="row"
                spacing={1.5}
                alignItems="center"
                flexWrap="wrap"
              >
                <Typography variant="h3" sx={{ overflowWrap: 'anywhere' }}>
                  {server.displayName}
                </Typography>
                <Chip
                  label={server.version}
                  size="small"
                  variant="outlined"
                  color="primary"
                />
              </Stack>
              <Stack
                direction="row"
                alignItems="center"
                flexWrap="wrap"
                columnGap={2}
                rowGap={1}
              >
                <Stack
                  direction="row"
                  alignItems="center"
                  spacing={0.5}
                  sx={{ pl: 1.25, pr: 0.5, borderRadius: 1, bgcolor: 'action.hover' }}
                >
                  <Typography variant="caption" color="text.secondary">
                    <FormattedMessage
                      id="aiWorkspace.pages.appShell.appShellPages.externalServers.overview.context.label"
                      defaultMessage="Context"
                    />
                  </Typography>
                  <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                    {server.context || '/'}
                  </Typography>
                  <Tooltip title={isContextCopied ? 'Copied' : 'Copy context'}>
                    <IconButton
                      size="small"
                      aria-label="Copy context"
                      onClick={() => void handleCopyContext()}
                    >
                      {isContextCopied ? (
                        <Check size={14} />
                      ) : (
                        <Copy size={14} />
                      )}
                    </IconButton>
                  </Tooltip>
                </Stack>
                <Tooltip
                  title={
                    server.updatedAt
                      ? new Date(server.updatedAt).toLocaleString()
                      : ''
                  }
                >
                  <Stack direction="row" spacing={0.75} alignItems="center">
                    <Clock size={14} />
                    <Typography variant="caption" color="text.secondary">
                      <FormattedMessage
                        id="aiWorkspace.pages.appShell.appShellPages.externalServers.overview.created"
                        defaultMessage="Updated {time}"
                        values={{ time: formatRelativeTime(server.updatedAt) }}
                      />
                    </Typography>
                  </Stack>
                </Tooltip>
              </Stack>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ maxWidth: 620 }}
              >
                {server.description}
              </Typography>
            </Stack>
            <Stack direction="row" alignItems="center" spacing={0.5}>
              {/* Edit page (name/version/context/description). Enabled even for
                  gateway-created MCP proxies — the page keeps the runtime fields
                  read-only and allows only the description. */}
              <Tooltip title="Edit MCP Proxy">
                <IconButton
                  component={RouterLink}
                  to="edit"
                  aria-label="Edit MCP Proxy"
                >
                  <Edit size={18} />
                </IconButton>
              </Tooltip>
              <Divider orientation="vertical" flexItem sx={{ my: 1 }} />
              <DisabledActionTooltip
                disabled={!canDeleteMcpProxy || Boolean(deleteBlockedReason)}
                title={
                  !canDeleteMcpProxy
                    ? NO_PERMISSION_TOOLTIP
                    : deleteBlockedReason
                }
              >
                <IconButton
                  color="error"
                  disabled={!canDeleteMcpProxy || Boolean(deleteBlockedReason)}
                  onClick={() => setIsDeleteDialogOpen(true)}
                  aria-label={`Delete ${server.displayName}`}
                  data-cyid="delete-mcp-proxy-button"
                >
                  <Trash2 size={18} />
                </IconButton>
              </DisabledActionTooltip>
            </Stack>
          </Stack>

          <Divider />
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: '1fr',
                md: API_PORTAL_ENABLED ? 'repeat(2, minmax(0, 1fr))' : '1fr',
              },
              gap: '1px',
              bgcolor: 'divider',
            }}
          >
            <OverviewLifecycleStage
              icon={<Rocket size={20} />}
              status={hasDeployments ? 'Deployed' : 'Not deployed'}
              isDone={hasDeployments}
              action={
                // For gateway-created (read-only) proxies, and for users holding only
                // the deployment-read scope, the deployments remain viewable (deploy/
                // redeploy/restore/undeploy are disabled on the page itself), so the
                // button navigates but is relabelled "View Deployments". Without even
                // deployment-read there is nothing to see, so it is disabled.
                <DisabledActionTooltip
                  disabled={!canViewDeployments}
                  title={NO_PERMISSION_TOOLTIP}
                >
                  <Button
                    variant={hasDeployments ? 'outlined' : 'contained'}
                    component={RouterLink}
                    to="deploy"
                    onClick={isReadOnlyServer ? undefined : handleBlockedNavigation}
                    disabled={!canViewDeployments}
                    sx={DISABLED_ACTION_SX}
                  >
                    {isReadOnlyServer || !canDeployMcpProxy ? (
                      <FormattedMessage
                        id="aiWorkspace.pages.appShell.appShellPages.externalServers.overview.viewDeployments"
                        defaultMessage="View Deployments"
                      />
                    ) : hasDeployments ? (
                      <FormattedMessage
                        id="aiWorkspace.pages.appShell.appShellPages.externalServers.overview.redeploy"
                        defaultMessage="Redeploy"
                      />
                    ) : (
                      <FormattedMessage
                        id="aiWorkspace.pages.appShell.appShellPages.externalServers.overview.deployToGateway"
                        defaultMessage="Deploy to Gateway"
                      />
                    )}
                  </Button>
                </DisabledActionTooltip>
              }
            />
            {API_PORTAL_ENABLED ? (
              <OverviewLifecycleStage
                icon={<Megaphone size={20} />}
                status={publicationStatusLabel}
                isDone={isPublished === true}
                action={
                  <DisabledActionTooltip
                    disabled={!canOpenPublishPage}
                    title={NO_PERMISSION_TOOLTIP}
                  >
                    <Button
                      variant={
                        hasDeployments && !isPublished ? 'contained' : 'outlined'
                      }
                      component={RouterLink}
                      to={publishUrl}
                      onClick={handleBlockedNavigation}
                      disabled={!canOpenPublishPage}
                      sx={DISABLED_ACTION_SX}
                    >
                      {isPublished ? 'Republish' : 'Publish to MCP Hub'}
                    </Button>
                  </DisabledActionTooltip>
                }
              />
            ) : null}
          </Box>
        </Card>

        {/* Tab Card - Overview & Policies */}
        <Card>
          <Tabs
            value={tabIndex}
            onChange={handleTabChange}
            variant="scrollable"
            allowScrollButtonsMobile
          >
            {TAB_LABELS.map((label) => (
              <Tab key={label} label={label} />
            ))}
          </Tabs>
          <Divider />
          <Box padding={2}>
            <TabPanel value={tabIndex} index={0}>
              {isGatewaysLoading ? (
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    mb: 1.5,
                  }}
                >
                  <CircularProgress size={16} />
                  <Typography variant="caption" color="text.secondary">
                    Loading gateways...
                  </Typography>
                </Box>
              ) : null}
              {deployedGateways.length > 0 ? (
                <Stack spacing={1.5} sx={{ mb: 2.5 }}>
                  <Box>
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                      MCP Proxy URL
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Change the Gateway to generate the gateway specific URL
                      and add that to your MCP client to try this out.
                    </Typography>
                  </Box>
                  <Grid container spacing={1} alignItems="flex-end">
                    <Grid size={{ xs: 12, md: 2 }}>
                      <FormControl fullWidth>
                        <FormLabel>Gateways</FormLabel>
                        <Select
                          size="small"
                          value={selectedGatewayId}
                          onChange={(event) =>
                            setSelectedGatewayId(String(event.target.value))
                          }
                          displayEmpty
                          disabled={deployedGateways.length === 0}
                        >
                          {deployedGateways.map((gateway) => (
                            <MenuItem key={gateway.id} value={gateway.id}>
                              {gateway.displayName || gateway.name}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid size={{ xs: 12, md: 4 }}>
                      <FormControl fullWidth>
                        <FormLabel>URL</FormLabel>
                        <TextField
                          size="small"
                          fullWidth
                          value={generatedInvokeUrl}
                          slotProps={{
                            input: {
                              readOnly: true,
                              endAdornment: (
                                <InputAdornment position="end">
                                  <Tooltip title="Copy URL" arrow>
                                    <span>
                                      <IconButton
                                        size="small"
                                        aria-label="Copy URL"
                                        onClick={() => {
                                          void handleCopyInvokeUrl();
                                        }}
                                        disabled={!generatedInvokeUrl}
                                      >
                                        <Copy size={16} />
                                      </IconButton>
                                    </span>
                                  </Tooltip>
                                </InputAdornment>
                              ),
                            },
                          }}
                        />
                      </FormControl>
                    </Grid>
                  </Grid>
                </Stack>
              ) : null}
              <Stack
                direction="row"
                alignItems="center"
                justifyContent="space-between"
                sx={{ mb: 1.5 }}
              >
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                  Capabilities
                </Typography>
                <Stack direction="row" alignItems="center" spacing={1}>
                  {!isReadOnlyServer ? (
                    <Tooltip
                      title="Use this if the MCP server's URL can't be reached to automatically fetch its tools, resources, and prompts."
                      placement="top"
                      arrow
                    >
                      <Info
                        size={14}
                        color="#8D91A3"
                        style={{ cursor: 'pointer' }}
                      />
                    </Tooltip>
                  ) : null}
                  <DisabledActionTooltip
                    disabled={isReadOnlyServer}
                    title="Capabilities are managed by the gateway that created this MCP proxy and are read-only here."
                  >
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<Plus size={16} />}
                      onClick={handleOpenCapabilitiesDrawer}
                      disabled={isReadOnlyServer}
                      sx={DISABLED_ACTION_SX}
                    >
                      Add Capabilities
                    </Button>
                  </DisabledActionTooltip>
                </Stack>
              </Stack>
              {validationResult ? (
                <ExternalServersValidationDetails
                  validationResult={validationResult}
                  showHeader={false}
                  showInputSchema
                />
              ) : (
                <Typography variant="body2" color="text.secondary">
                  <FormattedMessage
                    id="aiWorkspace.pages.appShell.appShellPages.externalServers.overview.noValidation"
                    defaultMessage="No validation data available."
                  />
                </Typography>
              )}
            </TabPanel>

            <TabPanel value={tabIndex} index={1}>
              {isReadOnlyServer && (
                <GatewayArtifactReadOnlyBanner message="Policies are managed by the gateway that created this MCP proxy and are read-only here." />
              )}
              <PolicyMapper
                selectedPolicies={selectedPolicies}
                onAddPolicy={handleAddPolicy}
                onUpdatePolicy={handleUpdatePolicy}
                onRemovePolicy={handleRemovePolicy}
                onReorderPolicies={handleReorderPolicies}
                validationResult={validationResult}
                readOnly={isReadOnlyServer}
              />
            </TabPanel>

            <TabPanel value={tabIndex} index={2}>
              {isReadOnlyServer && (
                <GatewayArtifactReadOnlyBanner message="Backend connection is managed by the gateway that created this MCP proxy and is read-only here." />
              )}
              <Stack spacing={2} sx={{ maxWidth: 640 }}>
                <FormControl fullWidth>
                  <FormLabel>MCP Proxy Endpoint URL</FormLabel>
                  <TextField
                    fullWidth
                    value={endpointUrl}
                    onChange={(event) => setEndpointUrl(event.target.value)}
                    disabled={isReadOnlyServer}
                    slotProps={{
                      htmlInput: {
                        'data-testid': 'backend-connection-endpoint-url',
                      },
                    }}
                  />
                </FormControl>
                <Grid container spacing={1.5}>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <FormControl fullWidth>
                      <FormLabel>Authentication Header</FormLabel>
                      <TextField
                        fullWidth
                        value={authHeaderName}
                        onChange={(event) =>
                          setAuthHeaderName(event.target.value)
                        }
                        disabled={isReadOnlyServer}
                        slotProps={{
                          htmlInput: {
                            'data-testid': 'backend-connection-auth-header',
                          },
                        }}
                      />
                    </FormControl>
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <FormControl fullWidth>
                      <FormLabel>Value</FormLabel>
                      <TextField
                        fullWidth
                        type={showAuthHeaderValue ? 'text' : 'password'}
                        value={authHeaderValue}
                        disabled={isReadOnlyServer}
                        onFocus={() => {
                          if (isCredentialMasked) {
                            setAuthHeaderValue('');
                            setIsCredentialMasked(false);
                            setHasCredentialChanged(false);
                          }
                        }}
                        onChange={(event) => {
                          setAuthHeaderValue(event.target.value);
                          setHasCredentialChanged(true);
                        }}
                        slotProps={{
                          htmlInput: {
                            'data-testid': 'backend-connection-auth-value',
                          },
                          input: {
                            endAdornment: (
                              <InputAdornment position="end">
                                <IconButton
                                  size="small"
                                  onClick={() =>
                                    setShowAuthHeaderValue((prev) => !prev)
                                  }
                                  aria-label={
                                    showAuthHeaderValue
                                      ? 'Hide header value'
                                      : 'Show header value'
                                  }
                                >
                                  {showAuthHeaderValue ? (
                                    <EyeOff size={18} />
                                  ) : (
                                    <Eye size={18} />
                                  )}
                                </IconButton>
                              </InputAdornment>
                            ),
                          },
                        }}
                      />
                    </FormControl>
                  </Grid>
                </Grid>
                <Box>
                  <Button
                    variant="outlined"
                    disabled={isRefetching || !endpointUrl.trim()}
                    onClick={() => void handleRefetch()}
                    data-testid="backend-connection-refetch"
                  >
                    {isRefetching ? 'Refetching...' : 'Refetch Server Info'}
                  </Button>
                </Box>
                {refetchedValidationResult ? (
                  <ExternalServersValidationDetails
                    validationResult={refetchedValidationResult}
                    variant="upstreamInfo"
                    showHeader={false}
                    showInputSchema
                  />
                ) : null}
              </Stack>
            </TabPanel>
          </Box>
        </Card>
      </Stack>

      <Box
        sx={{
          position: 'sticky',
          bottom: 0,
          zIndex: 10,
        }}
      >
        <Card>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1}
            alignItems={{ xs: 'flex-start', sm: 'center' }}
            justifyContent="space-between"
            sx={{ p: 2 }}
          >
            <Typography
              variant="body2"
              color={hasUnsavedChanges ? 'warning.main' : 'text.secondary'}
            >
              {hasUnsavedChanges ? 'You have unsaved changes.' : ''}
            </Typography>
            <Stack direction="row" spacing={1}>
              <Button
                variant="outlined"
                color="secondary"
                disabled={
                  isReadOnlyServer || !hasUnsavedChanges || isSavingChanges
                }
                onClick={handleCancelChanges}
              >
                Cancel
              </Button>
              <Button
                variant="contained"
                disabled={
                  isReadOnlyServer || !hasUnsavedChanges || isSavingChanges
                }
                onClick={() => void handleSaveChanges()}
              >
                {isSavingChanges ? 'Saving...' : 'Save'}
              </Button>
            </Stack>
          </Stack>
        </Card>
      </Box>

      <Dialog
        open={isDeleteDialogOpen}
        onClose={() => {
          if (isDeleting) return;
          setIsDeleteDialogOpen(false);
        }}
      >
        <DialogTitle>Delete MCP Proxy</DialogTitle>
        <DialogContent>
          {isReadOnlyServer ? (
            <GatewayArtifactDeleteWarning
              artifactType="MCP Proxy"
              artifactName={server.displayName}
            />
          ) : null}
          <DialogContentText>
            Are you sure you want to delete{' '}
            <strong>{server.displayName}</strong>? This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button
            variant="outlined"
            color="secondary"
            disabled={isDeleting}
            onClick={() => setIsDeleteDialogOpen(false)}
          >
            Cancel
          </Button>
          <Button
            color="error"
            disabled={isDeleting}
            onClick={() => void handleDeleteConfirm()}
            data-cyid="delete-mcp-proxy-confirm-button"
          >
            {isDeleting ? <CircularProgress size={20} /> : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>

      <CapabilitiesDrawer
        open={isCapabilitiesDrawerOpen}
        initialValue={capabilitiesDrawerInitialValue}
        onClose={() => setIsCapabilitiesDrawerOpen(false)}
        onApply={handleApplyCapabilities}
      />
    </PageContent>
  );
}
