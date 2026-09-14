export type TrialStructureNode = {
  id: string;
  parentId: string;
  nodeType: 'road' | 'site' | 'structure' | 'section' | 'element' | 'activity';
  name: string;
};

const pathToNode = (nodes: TrialStructureNode[], nodeId: string) => {
  const byId = new Map(nodes.map(node => [node.id, node]));
  const path: TrialStructureNode[] = [];
  const visited = new Set<string>();
  let current = byId.get(nodeId);
  while (current && !visited.has(current.id)) {
    path.unshift(current);
    visited.add(current.id);
    current = byId.get(current.parentId);
  }
  return path;
};

export const trialStructureOptions = (nodes: TrialStructureNode[]) =>
  nodes.map(node => ({
    id: node.id,
    label: pathToNode(nodes, node.id).map(item => item.name).filter(Boolean).join(' › '),
  }));

export const trialStructureSelectionPatch = (nodes: TrialStructureNode[], nodeId: string) => {
  if (!nodeId) return {
    structureNodeId: '', trialSectionNodeId: '', elementNodeId: '', elementName: '', element: '', subElementNodeId: '', subElement: '',
  };
  const path = pathToNode(nodes, nodeId);
  const selected = path[path.length - 1];
  const reverse = [...path].reverse();
  const section = reverse.find(node => node.nodeType === 'section');
  const element = reverse.find(node => ['element', 'structure', 'site', 'road'].includes(node.nodeType));
  const activity = reverse.find(node => node.nodeType === 'activity');
  return {
    structureNodeId: selected?.id || '',
    trialSectionNodeId: section?.id || '',
    elementNodeId: element?.id || '',
    elementName: element?.name || selected?.name || '',
    element: element?.name || selected?.name || '',
    subElementNodeId: activity?.id || '',
    subElement: activity?.name || '',
  };
};
