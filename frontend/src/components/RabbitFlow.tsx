import React, { useCallback } from 'react';
import ReactFlow, {
  Node,
  Edge,
  NodeTypes,
  OnNodesChange,
  OnEdgesChange,
  OnConnect,
  Connection,
  useNodesState,
  useEdgesState,
  Panel,
  Controls,
  Background,
  BackgroundVariant,
  addEdge,
  ConnectionLineType,
  Position,
  MiniMap,
  MarkerType,
} from 'reactflow';
import dagre from '@dagrejs/dagre';
import 'reactflow/dist/style.css';

interface RabbitFlowProps {
  initialNodes: Node[];
  initialEdges: Edge[];
  nodeTypes: NodeTypes;
  onNodeClick?: (node: Node) => void;
  conversationHistory?: any[];
}

const getLayoutedElements = (nodes: Node[], edges: Edge[]) => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));

  // Check if any nodes are expanded
  const hasExpandedNodes = nodes.some(
    (node) => node.type === 'mainNode' && node.data.isExpanded
  );

  dagreGraph.setGraph({
    rankdir: 'LR',
    nodesep: 100,
    ranksep: hasExpandedNodes ? 200 : 100, // Adjust vertical spacing based on expansion
    marginx: 200,
    marginy: hasExpandedNodes ? 200 : 100,
    align: 'UL',
    ranker: 'tight-tree',
  });

  // Add nodes to the graph with their actual dimensions
  nodes.forEach((node) => {
    const isMainNode = node.type === 'mainNode';
    dagreGraph.setNode(node.id, {
      width: isMainNode ? 600 : 300,
      height: isMainNode ? 500 : 100,
    });
  });

  // Add edges to the graph
  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  // Apply layout
  dagre.layout(dagreGraph);

  // Get the positioned nodes
  const newNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    const isMainNode = node.type === 'mainNode';
    const width = isMainNode ? 600 : 300;
    const height = isMainNode ? 500 : 100;
    return {
      ...node,
      position: {
        x: nodeWithPosition.x - width / 2,
        y: nodeWithPosition.y - height / 2,
      },
      targetPosition: Position.Left,
      sourcePosition: Position.Right,
    };
  });

  const newEdges = edges.map((edge) => ({
    ...edge,
    type: 'default',
    animated: true,
    style: {
      stroke: 'rgba(248, 248, 248, 0.8)',
      strokeWidth: 1.5,
    },
    markerEnd: {
      type: MarkerType.ArrowClosed,
      color: 'rgba(248, 248, 248, 0.8)',
    },
  }));

  return { nodes: newNodes, edges: newEdges };
};

const RabbitFlow: React.FC<RabbitFlowProps> = ({
  initialNodes,
  initialEdges,
  nodeTypes,
  onNodeClick,
  conversationHistory = [],
}) => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  React.useEffect(() => {
    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
      initialNodes,
      initialEdges
    );
    setNodes(layoutedNodes);
    setEdges(layoutedEdges);
  }, [initialNodes, initialEdges]);

  React.useEffect(() => {
    if (conversationHistory?.length) {
      // Create nodes and edges from conversation history
      const historyNodes = conversationHistory.map((item, index) => ({
        id: `history-${index}`,
        type: 'mainNode',
        data: {
          label: item.query,
          content: item.response.response,
          images: item.response.images?.map((img: any) => img.url),
          sources: item.response.sources,
          isExpanded: true,
        },
        position: { x: 0, y: 0 }, // Will be positioned by dagre
        style: {
          width: 600,
          minHeight: 500,
          background: '#1a1a1a',
          color: '#fff',
          border: '1px solid #333',
          borderRadius: '8px',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
          cursor: 'default',
        },
      }));

      // Create question nodes for each history item
      const questionNodes: Node[] = [];
      const questionEdges: Edge[] = [];

      conversationHistory.forEach((item, index) => {
        const parentId = `history-${index}`;

        item.response.followUpQuestions.forEach(
          (question: string, qIndex: number) => {
            const questionId = `question-${parentId}-${qIndex}`;

            questionNodes.push({
              id: questionId,
              type: 'default',
              data: {
                label: question,
                isExpanded: false,
                content: '',
                images: [],
                sources: [],
              },
              position: { x: 0, y: 0 },
              style: {
                width: 300,
                background: '#1a1a1a',
                color: '#fff',
                border: '1px solid #333',
                borderRadius: '8px',
                fontSize: '14px',
                textAlign: 'left',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                cursor: 'pointer',
              },
            });

            questionEdges.push({
              id: `edge-${questionId}`,
              source: parentId,
              target: questionId,
              type: 'default',
              animated: true,
              style: {
                stroke: 'rgba(248, 248, 248, 0.8)',
                strokeWidth: 1.5,
              },
              markerEnd: {
                type: MarkerType.ArrowClosed,
                color: 'rgba(248, 248, 248, 0.8)',
              },
            });
          }
        );
      });

      // Create edges between history nodes
      const historyEdges = conversationHistory.slice(1).map((_, index) => ({
        id: `history-edge-${index}`,
        source: `history-${index}`,
        target: `history-${index + 1}`,
        type: 'default',
        animated: true,
        style: {
          stroke: 'rgba(248, 248, 248, 0.8)',
          strokeWidth: 1.5,
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: 'rgba(248, 248, 248, 0.8)',
        },
      }));

      const { nodes: layoutedNodes, edges: layoutedEdges } =
        getLayoutedElements(
          [...historyNodes, ...questionNodes],
          [...historyEdges, ...questionEdges]
        );

      setNodes(layoutedNodes);
      setEdges(layoutedEdges);
    }
  }, [conversationHistory]);

  const onConnect = useCallback(
    (params: Connection) =>
      setEdges((eds) =>
        addEdge(
          {
            ...params,
            type: 'default',
            animated: true,
            style: {
              stroke: 'rgba(248, 248, 248, 0.8)',
              strokeWidth: 1.5,
            },
            markerEnd: {
              type: MarkerType.ArrowClosed,
              color: 'rgba(248, 248, 248, 0.8)',
            },
          },
          eds
        )
      ),
    [setEdges]
  );

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      if (onNodeClick) {
        onNodeClick(node);
      }
    },
    [onNodeClick]
  );

  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={handleNodeClick}
        nodeTypes={nodeTypes}
        connectionLineType={ConnectionLineType.Bezier}
        defaultEdgeOptions={{
          type: 'default',
          animated: true,
          style: { stroke: 'rgba(255, 255, 255, 0.3)' },
        }}
        fitView
        zoomOnScroll={true}
        panOnScroll={false}
        zoomOnPinch={true}
        preventScrolling={false}
        style={{ backgroundColor: '#000000' }}
      >
        <Controls className="!bg-[#111111] !border-gray-800" />
        <MiniMap
          style={{
            backgroundColor: '#111111',
            border: '1px solid #333333',
            borderRadius: '4px',
          }}
          nodeColor="#666666"
          maskColor="rgba(0, 0, 0, 0.7)"
          className="!bottom-4 !right-4"
        />
        <Background
          variant={BackgroundVariant.Dots}
          gap={12}
          size={1}
          color="rgba(255, 255, 255, 0.05)"
        />
      </ReactFlow>
    </div>
  );
};

export default RabbitFlow;
