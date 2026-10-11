import {
  Activity,
  AlertCircle,
  CheckCircle2,
  Info,
  Terminal,
  Save,
  Trash2,
  Plus,
  X,
  Upload,
  Download,
  ChevronDown,
  ChevronUp,
  Copy,
  ExternalLink,
  Play,
  Square,
  RotateCcw,
} from "lucide-react";
export const PluginIcon = ({ name, size = 20, className = "" }) => {
  const icons = {
    Activity,
    AlertCircle,
    CheckCircle2,
    Info,
    Terminal,
    Save,
    Trash2,
    Plus,
    X,
    Upload,
    Download,
    ChevronDown,
    ChevronUp,
    Copy,
    ExternalLink,
    Play,
    Square,
    RotateCcw,
  };
  const LucideIcon = icons[name] || Info;
  return <LucideIcon size={size} className={className} />;
};
