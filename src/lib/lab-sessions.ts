import type { LabCategory } from "./lab-data"

export interface LabSession {
  labId: string
  date: string // YYYY-MM-DD
  minutes: number
  note?: string
  createdAt: string
}

export interface LabDefinition {
  id: string
  name: string
  url: string
  focus: string
  defaultCategory: LabCategory
}

export interface LabsStorage {
  labs: LabDefinition[]
  sessions: LabSession[]
  categories: Record<string, LabCategory>
  customFocus?: Record<string, string>
}

export const DEFAULT_EXTERNAL_LABS: LabDefinition[] = [
  { id: "blueteamlabs", name: "Blue Team Labs Online", url: "https://blueteamlabs.online", focus: "Blue Team", defaultCategory: "blue" },
  { id: "letsdefend", name: "LetsDefend", url: "https://letsdefend.io", focus: "Blue Team", defaultCategory: "blue" },
  { id: "tryhackme", name: "TryHackMe", url: "https://tryhackme.org", focus: "General Security", defaultCategory: "purple" },
  { id: "threathuntinglabs", name: "Threat Hunting Labs", url: "https://threathuntinglabs.com", focus: "Threat Hunting", defaultCategory: "blue" },
  { id: "cyberdefenders", name: "CyberDefenders", url: "https://cyberdefenders.org", focus: "DFIR", defaultCategory: "dfir" },
  { id: "dfirlabs", name: "DFIR Labs", url: "https://dfirlabs.thedfirreport.com", focus: "DFIR", defaultCategory: "dfir" },
  { id: "infinity", name: "Infinity Cyber Warfare", url: "https://infinity.cyberwarfare.live", focus: "Offensive", defaultCategory: "purple" },
  { id: "hackthebox", name: "Hack The Box", url: "https://hackthebox.com", focus: "Offensive", defaultCategory: "purple" },
  { id: "offsec-pg", name: "OffSec PG Play", url: "https://offsec.com/pg", focus: "Offensive", defaultCategory: "red" },
  { id: "pwnedlabs", name: "PwnedLabs", url: "https://pwnedlabs.io", focus: "Cloud Security", defaultCategory: "purple" },
  { id: "redlabs", name: "Red Labs Enterprise", url: "https://redlabs.enterprisesecurity.io", focus: "Offensive", defaultCategory: "red" },
  { id: "aceresponder", name: "AceResponder", url: "https://www.aceresponder.com", focus: "Incident Response", defaultCategory: "blue" },
  { id: "xintra", name: "XINTRA", url: "https://www.xintra.org", focus: "Cloud Security", defaultCategory: "blue" },
  { id: "ridgeline", name: "Ridgeline Cyber", url: "https://training.ridgelinecyber.com", focus: "Blue Team", defaultCategory: "blue" },
  { id: "slayerlabs", name: "SlayerLabs", url: "https://slayerlabs.com", focus: "Offensive", defaultCategory: "red" },
  { id: "bluecape", name: "Blue Cape Security", url: "https://bluecapesecurity.com", focus: "Blue Team", defaultCategory: "blue" },
  { id: "hackforge", name: "HackForge", url: "https://hackforge.com", focus: "General Security", defaultCategory: "purple" },
  { id: "hackviser", name: "Hackviser", url: "https://hackviser.com", focus: "General Security", defaultCategory: "purple" },
  { id: "invictus", name: "Invictus IR CloudLabs", url: "https://cloudlabs.invictus-ir.com", focus: "Cloud IR", defaultCategory: "dfir" },
  { id: "malware-traffic", name: "Malware Traffic Analysis", url: "https://www.malware-traffic-analysis.net", focus: "Malware Analysis", defaultCategory: "dfir" },
  { id: "extremeredlab", name: "Extreme Red Lab", url: "https://extremeredlab.0x29a.it", focus: "Offensive", defaultCategory: "red" },
  { id: "networkdefense", name: "Network Defense", url: "https://www.networkdefense.io/subscribe", focus: "Network Defense", defaultCategory: "blue" },
  { id: "pentesterlab", name: "PentesterLab", url: "https://pentesterlab.com/pro", focus: "Web App Security", defaultCategory: "red" },
  { id: "entragoat", name: "EntraGoat", url: "https://github.com/semperis/entragoat", focus: "Azure Security", defaultCategory: "purple" },
  { id: "hackinghub", name: "HackingHub", url: "https://www.hackinghub.io", focus: "General Security", defaultCategory: "purple" },
  { id: "hacksmarter", name: "HackSmarter", url: "https://www.hacksmarter.org", focus: "General Security", defaultCategory: "purple" },
]
