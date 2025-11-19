import React, { useRef, useEffect, useState, useImperativeHandle } from 'react';
import { type MindMapNode } from '../types';

// Using d3 v3 from the script tag
declare const d3: any;

interface MindMapViewProps {
  data: MindMapNode;
  selectedNodeIds: number[];
  onToggleNodeSelection: (node: D3Node | null, isCtrl: boolean) => void;
  isPanMode: boolean;
}

// Augment the D3 node type with our custom properties.
export interface D3Node extends MindMapNode {
  id: number;
  _children?: D3Node[];
  children?: D3Node[];
  x0?: number;
  y0?: number;
  x: number;
  y: number;
  depth: number;
  parent?: D3Node;
  color?: string;
  image?: string;
  link?: string;
}

export interface MindMapViewHandles {
  zoomIn: () => void;
  zoomOut: () => void;
  reset: () => void;
  editNode: (nodeId: number) => void;
  addChild: (nodeId: number) => void;
  addSibling: (nodeId: number) => void;
  deleteNodes: (nodeIds: number[]) => void;
  detachNode: (nodeId: number) => void;
  changeColors: (nodeIdToColorMap: Map<number, string | null>) => void;
  updateNodeData: (nodeId: number, data: Partial<MindMapNode>) => void;
}

const isColorDark = (hexColor?: string): boolean => {
    if (!hexColor) return false;
    try {
        const color = (hexColor.charAt(0) === '#') ? hexColor.substring(1, 7) : hexColor;
        const r = parseInt(color.substring(0, 2), 16);
        const g = parseInt(color.substring(2, 4), 16);
        const b = parseInt(color.substring(4, 6), 16);
        // http://www.w3.org/TR/AERT#color-contrast
        const brightness = ((r * 299) + (g * 587) + (b * 114)) / 1000;
        return brightness < 128;
    } catch (e) {
        return false;
    }
};

const renderNodeText = (text: string) => {
    if (!text) return '';
    // Basic markdown for bold text. Sanitize by replacing < and >.
    return text
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
};

const findNodeAndParent = (root: D3Node, nodeId: number, parent: D3Node | null = null): { node: D3Node; parent: D3Node | null } | null => {
    if (root.id === nodeId) {
        return { node: root, parent };
    }
    const children = root.children || root._children || [];
    for (const child of children) {
        const found = findNodeAndParent(child, nodeId, root);
        if (found) return found;
    }
    return null;
};

// A custom clone function to prevent "circular structure" errors from D3's parent references.
const cloneTree = (node: D3Node): D3Node => {
    const newNode: any = {
        name: node.name,
        id: node.id,
        depth: node.depth,
    };
    if (node.color) newNode.color = node.color;
    if (node.image) newNode.image = node.image;
    if (node.link) newNode.link = node.link;
    
    if (node.x0) newNode.x0 = node.x0;
    if (node.y0) newNode.y0 = node.y0;
    if (node.x) newNode.x = node.x;
    if (node.y) newNode.y = node.y;

    if (node.children) {
        newNode.children = node.children.map(cloneTree);
    }
    if (node._children) {
        newNode._children = node._children.map(cloneTree);
    }
    return newNode as D3Node;
};


const MindMapView = React.forwardRef<MindMapViewHandles, MindMapViewProps>(({ data, selectedNodeIds, onToggleNodeSelection, isPanMode }, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const zoomBehavior = useRef<any>(null);
  const zoomState = useRef<{ translate: [number, number], scale: number } | null>(null);
  const nodeIdCounter = useRef(0);
  
  const [internalData, setInternalData] = useState<D3Node | null>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [editingNodeId, setEditingNodeId] = useState<number | null>(null);

  useEffect(() => {
    nodeIdCounter.current = 0;
    const assignIdsAndCollapse = (node: MindMapNode, depth = 0): D3Node => {
        const d3Node: D3Node = {
            name: node.name,
            color: node.color,
            image: node.image,
            link: node.link,
            id: nodeIdCounter.current++,
            x: 0, y: 0, depth: depth,
        };
        if (node.children) {
            if (depth > 0) {
                d3Node._children = node.children.map(child => assignIdsAndCollapse(child, depth + 1));
            } else {
                d3Node.children = node.children.map(child => assignIdsAndCollapse(child, depth + 1));
            }
        }
        return d3Node;
    };
    setInternalData(assignIdsAndCollapse(data));
  }, [data]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver(entries => {
      if (entries[0]) {
        const { width, height } = entries[0].contentRect;
        if (width > 0 && height > 0) {
          setDimensions({ width, height });
        }
      }
    });
    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, []);

  const centerAndFit = (svgSelection: any, treeLayout: any) => {
    if (!internalData || !svgSelection || !treeLayout || dimensions.width === 0) return;
    const nodes = treeLayout.nodes(internalData);
    if (nodes.length === 0) return;
    
    const x_coords = nodes.map((n: D3Node) => n.x);
    const y_coords = nodes.map((n: D3Node) => n.y);
    const min_x = d3.min(x_coords);
    const max_x = d3.max(x_coords);
    const min_y = d3.min(y_coords);
    const max_y = d3.max(y_coords);
    
    const treeWidth = max_y - min_y;
    const treeHeight = max_x - min_x;

    const scaleX = treeWidth > 0 ? (dimensions.width - 240) / treeWidth : 1;
    const scaleY = treeHeight > 0 ? (dimensions.height - 80) / treeHeight : 1;
    const scale = Math.min(scaleX, scaleY, 1.2);
    
    const translateX = (dimensions.width / 2) - ((min_y + treeWidth / 2) * scale) + 60; // Adjust for left-heavy layout
    const translateY = (dimensions.height / 2) - ((min_x + treeHeight / 2) * scale);

    // Manually update state immediately to prevent race conditions
    zoomState.current = { translate: [translateX, translateY], scale: scale };
    
    // Apply immediately without transition to avoid "snap back" race conditions
    zoomBehavior.current.translate([translateX, translateY]).scale(scale);
    svgSelection.call(zoomBehavior.current.event);
  };

  // Main D3 Rendering Effect
  useEffect(() => {
    if (!internalData || !svgRef.current || dimensions.width === 0) return;
    
    const { width, height } = dimensions;

    const treeLayout = d3.layout.tree().nodeSize([100, 40]);
    const diagonalGenerator = d3.svg.diagonal().projection((d: {x: number, y: number}) => [d.y, d.x]);
    
    const svgSelection = d3.select(svgRef.current);

    zoomBehavior.current = d3.behavior.zoom()
        .scaleExtent([0.1, 2])
        .on("zoomstart", () => {
            svgSelection.classed("is-dragging", true);
        })
        .on("zoomend", () => {
            svgSelection.classed("is-dragging", false);
        })
        .on("zoom", () => {
            const t = d3.event.translate;
            const s = d3.event.scale;
            if (containerG) {
                containerG.attr("transform", "translate(" + t + ")scale(" + s + ")");
            }
            // Persist zoom state to prevent snapping back on re-renders
            zoomState.current = { translate: t, scale: s };
        });

    svgSelection
        .html("") // Clear previous render
        .attr("width", width)
        .attr("height", height)
        .classed("mindmap-view", true)
        .classed("is-panning", isPanMode)
        .call(zoomBehavior.current)
        .on("click", () => {
            if (d3.event.defaultPrevented) return; // Prevent click if drag occurred
            if (isPanMode) return;
            onToggleNodeSelection(null, false)
        });

    const containerG = svgSelection.append("g");
    
    const root: D3Node = internalData;
    root.x0 = height / 2;
    root.y0 = 0;
    
    // Restore zoom state if available, otherwise center
    if (zoomState.current) {
        zoomBehavior.current.translate(zoomState.current.translate).scale(zoomState.current.scale);
        containerG.attr("transform", "translate(" + zoomState.current.translate + ")scale(" + zoomState.current.scale + ")");
    } else {
        // We will center after updating the chart to ensure we have node positions
    }

    updateChart(root, root);
    
    // Only center if no zoom state exists (first render)
    if (!zoomState.current) {
        centerAndFit(svgSelection, treeLayout);
    }
    
    function updateChart(sourceNode: D3Node, rootNode: D3Node) {
        const duration = 500;
        
        const nodes = treeLayout.nodes(rootNode).reverse();
        const links = treeLayout.links(nodes);

        nodes.forEach((d: D3Node) => { d.y = d.depth * 280; }); // Increase spacing

        const node = containerG.selectAll("g.node").data(nodes, (d: D3Node) => d.id);

        // --- ENTER NODES ---
        const nodeEnter = node.enter().append("g")
            .attr("class", d => `node node-id-${d.id}`)
            .attr("transform", () => `translate(${sourceNode.y0 || sourceNode.y},${sourceNode.x0 || sourceNode.x})`)
            .on("click", function(d: D3Node) {
                if (d3.event.defaultPrevented) return; // Prevent click if drag occurred
                if (isPanMode) return;
                d3.event.stopPropagation();
                const isCtrl = d3.event.ctrlKey || d3.event.metaKey;
                onToggleNodeSelection(d, isCtrl);
            })
            .on("dblclick", function(d: D3Node) {
                if (isPanMode) return;
                if (d3.event.defaultPrevented) return;
                d3.event.preventDefault();
                d3.event.stopPropagation();

                const isCollapsed = d._children && d._children.length > 0;
                if (isCollapsed) {
                    d.children = d._children;
                    d._children = undefined;
                }

                // Recalculate layout to get final positions
                const allNodes = treeLayout.nodes(rootNode).reverse();
                allNodes.forEach((n: D3Node) => { n.y = n.depth * 280; });

                const targetNode = allNodes.find((n: D3Node) => n.id === d.id);
                if (!targetNode) return;
                
                const childrenNodes = targetNode.children || [];
                const points = [targetNode, ...childrenNodes];

                const xCoords = points.map(p => p.x);
                const yCoords = points.map(p => p.y);

                const minX = d3.min(xCoords);
                const maxX = d3.max(xCoords);
                const minY = d3.min(yCoords);
                const maxY = d3.max(yCoords);

                const nodeWidth = 180;
                const nodeHeight = 100;
                const padding = 80;

                const boundsWidth = (maxY - minY) + nodeWidth + padding;
                const boundsHeight = (maxX - minX) + nodeHeight + padding;

                const { width, height } = dimensions;
                if (width === 0 || height === 0 || boundsWidth <= 0 || boundsHeight <= 0) return;

                const scale = Math.min(width / boundsWidth, height / boundsHeight, 1.5);

                const boundsCenterX = minY + (maxY - minY) / 2;
                const boundsCenterY = minX + (maxX - minX) / 2;

                const translateX = width / 2 - boundsCenterX * scale;
                const translateY = height / 2 - boundsCenterY * scale;

                // Manually update state
                zoomState.current = { translate: [translateX, translateY], scale: scale };

                svgSelection.transition().duration(750)
                    .call(zoomBehavior.current.translate([translateX, translateY]).scale(scale).event);

                // Only call updateChart if the structure actually changed
                if (isCollapsed) {
                    updateChart(d, rootNode);
                }
            });
        
        const foWidth = 180;
        const foHeight = 120; // Increased slightly to accommodate optional image/link

        nodeEnter.append("foreignObject")
            .attr("width", foWidth)
            .attr("height", foHeight)
            .attr("x", -foWidth / 2)
            .attr("y", -foHeight / 2)
            .style("overflow", "visible")
            .append("xhtml:div")
              .attr("class", (d: D3Node) => `mindmap-node-body ${d.depth === 0 ? 'is-root' : ''}`)
              .html((d: D3Node) => {
                const imgHtml = d.image ? `<img src="${d.image}" class="mindmap-node-image" draggable="false" />` : '';
                const linkHtml = d.link ? `<a href="${d.link}" target="_blank" class="mindmap-node-link" onclick="event.stopPropagation()"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:12px;height:12px;"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg></a>` : '';
                const textHtml = `<div class="node-text">${renderNodeText(d.name)}</div>`;
                return `${linkHtml}${imgHtml}${textHtml}`;
              });
        
        const toggle = nodeEnter.append("g")
            .attr("class", "node-toggle")
            .on("click", (d: D3Node) => { 
                if (isPanMode) return;
                if (d3.event.defaultPrevented) return;
                d3.event.stopPropagation(); // Prevent selection when toggling
                if (d.children) {
                    d._children = d.children;
                    d.children = undefined;
                } else {
                    d.children = d._children;
                    d._children = undefined;
                }
                updateChart(d, rootNode);
            });
        
        toggle.append("circle")
            .attr("r", 10)
            .attr("class", "mindmap-node-toggle-btn");
        
        toggle.append("text")
            .attr("dy", "0.35em")
            .attr("text-anchor", "middle")
            .style("fill", "var(--text-primary)")
            .style("font-size", "14px")
            .style("font-weight", "bold")
            .text((d: D3Node) => d._children ? '+' : '-');

        // --- UPDATE NODES ---
        const nodeUpdate = node.transition().duration(duration)
            .attr("transform", (d: D3Node) => `translate(${d.y},${d.x})`);

        // Apply class changes directly to the selection, not the transition, as `classed` is not a transition method.
        node.select(".mindmap-node-body")
            .classed("is-selected", (d: D3Node) => selectedNodeIds.includes(d.id));

        // Apply style changes to the transition so they animate smoothly.
        nodeUpdate.select(".mindmap-node-body")
            .style('background-color', (d: D3Node) => d.color || null)
            .style('border-color', (d: D3Node) => d.color || null)
            .style('color', (d: D3Node) => {
                if (d.color && isColorDark(d.color)) return 'var(--user-bubble-text)';
                if (d.depth === 0 && !d.color) return 'var(--user-bubble-text)';
                return null;
            });
        
        // Re-render HTML content on update (allows image/link changes to reflect)
        node.select(".mindmap-node-body").html((d: D3Node) => {
             const imgHtml = d.image ? `<img src="${d.image}" class="mindmap-node-image" draggable="false" />` : '';
             const linkHtml = d.link ? `<a href="${d.link}" target="_blank" class="mindmap-node-link" onclick="event.stopPropagation()"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:12px;height:12px;"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg></a>` : '';
             const textHtml = `<div class="node-text">${renderNodeText(d.name)}</div>`;
             return `${linkHtml}${imgHtml}${textHtml}`;
        });

        nodeUpdate.select(".node-toggle")
            .attr("transform", (d: D3Node) => `translate(${d.depth === 0 ? 0 : foWidth/2}, 0)`)
            .style("display", (d: D3Node) => d.children || d._children ? "block" : "none")
            .select("text")
            .text((d: D3Node) => d._children ? '+' : '-');

        // --- EXIT NODES ---
        node.exit().transition().duration(duration)
            .attr("transform", () => `translate(${sourceNode.y},${sourceNode.x})`).remove();

        // --- LINKS ---
        const link = containerG.selectAll("path.link").data(links, (d: any) => d.target.id);
        
        link.enter().insert("path", "g")
            .attr("class", "link")
            .attr("d", () => {
                const o = { x: sourceNode.x0 || 0, y: sourceNode.y0 || 0 };
                return diagonalGenerator({ source: o, target: o });
            })
            .style({ fill: "none", "stroke-width": "2px" })
            .style("stroke", (d: any) => d.target.color || "var(--border)");

        link.transition().duration(duration)
            .attr("d", diagonalGenerator)
            .style("stroke", (d: any) => d.target.color || "var(--border)");

        link.exit().transition().duration(duration)
            .attr("d", () => {
                const o = { x: sourceNode.x, y: sourceNode.y };
                return diagonalGenerator({ source: o, target: o });
            }).remove();

        nodes.forEach((d: D3Node) => { d.x0 = d.x; d.y0 = d.y; });
    }
  }, [internalData, dimensions, onToggleNodeSelection, selectedNodeIds, isPanMode]);

  // Effect for handling inline editing
  useEffect(() => {
    if (editingNodeId === null || !svgRef.current) return;
    
    onToggleNodeSelection(null, false); // Deselect while editing

    const node = d3.select(`.node-id-${editingNodeId}`);
    if (node.empty()) {
        setEditingNodeId(null);
        return;
    }

    const nodeTextDiv = node.select('.node-text');
    const d = node.datum();
    const initialText = d.name;

    // Only make the text part editable, not the image
    nodeTextDiv
      .attr('contentEditable', true)
      .style('outline', 'none')
      .style('min-width', '20px')
      .on('blur', function() {
        this.contentEditable = false;
        const newName = this.textContent.trim();
        
        if (newName && newName !== initialText) {
          d.name = newName;
          handleAction(tree => {
              const found = findNodeAndParent(tree, d.id);
              if (found) found.node.name = newName;
          });
        } else {
          this.innerHTML = renderNodeText(initialText); // Revert if empty
        }
        setEditingNodeId(null);
      })
      .on('keydown', function() {
        if (d3.event.key === 'Enter' && !d3.event.shiftKey) {
            d3.event.preventDefault();
            this.blur();
        }
        if (d3.event.key === 'Escape') {
            this.textContent = initialText;
            this.blur();
        }
      });
      
    const el = nodeTextDiv.node();
    el.focus();
    // Move cursor to end
    const range = document.createRange();
    const sel = window.getSelection();
    range.selectNodeContents(el);
    range.collapse(false);
    sel.removeAllRanges();
    sel.addRange(range);
  }, [editingNodeId, onToggleNodeSelection]);

  const handleAction = (action: (tree: D3Node) => D3Node | void) => {
    if (!internalData) return;
    const clonedData = cloneTree(internalData);
    const result = action(clonedData);
    setInternalData(result || clonedData);
  };

  useImperativeHandle(ref, () => ({
    zoomIn: () => {
      if (!zoomBehavior.current) return;
      const svgSelection = d3.select(svgRef.current);
      svgSelection.transition().duration(500).call(zoomBehavior.current.scale(zoomBehavior.current.scale() * 1.2).event);
    },
    zoomOut: () => {
       if (!zoomBehavior.current) return;
       const svgSelection = d3.select(svgRef.current);
       svgSelection.transition().duration(500).call(zoomBehavior.current.scale(zoomBehavior.current.scale() * 0.8).event);
    },
    reset: () => {
       if (!internalData) return;
       const svgSelection = d3.select(svgRef.current);
       const tree = d3.layout.tree().nodeSize([100, 40]);
       centerAndFit(svgSelection, tree);
    },
    editNode: (nodeId) => setEditingNodeId(nodeId),
    addChild: (nodeId) => handleAction(tree => {
        const found = findNodeAndParent(tree, nodeId);
        if (!found) return;
        const { node: targetNode } = found;

        if (!targetNode.children) {
            targetNode.children = targetNode._children || [];
            targetNode._children = undefined;
        }
        targetNode.children.push({
            id: nodeIdCounter.current++, name: 'Nhánh mới', depth: targetNode.depth + 1, x:0, y:0
        });
    }),
    addSibling: (nodeId) => handleAction(tree => {
        const found = findNodeAndParent(tree, nodeId);
        if (!found || !found.parent) return;
        const { node: targetNode, parent } = found;

        const children = parent.children || parent._children;
        if (!children) return;

        const index = children.findIndex(c => c.id === targetNode.id);
        children.splice(index + 1, 0, {
        id: nodeIdCounter.current++, name: 'Mục mới', depth: targetNode.depth, x:0, y:0
        });
    }),
    detachNode: (nodeId) => handleAction(tree => {
        const found = findNodeAndParent(tree, nodeId);
        if (!found || !found.parent) return;

        const grandParentSearchResult = findNodeAndParent(tree, found.parent.id);
        if (!grandParentSearchResult) return;

        const { node: targetNode, parent: originalParent } = found;
        const grandParent = grandParentSearchResult.parent;
        const newParent = grandParent || tree;

        let originalParentChildren = originalParent.children || originalParent._children;
        if (originalParentChildren) {
            const index = originalParentChildren.findIndex(c => c.id === targetNode.id);
            if (index !== -1) originalParentChildren.splice(index, 1);
        }

        if (!newParent.children) {
            newParent.children = newParent._children || [];
            newParent._children = undefined;
        }
        const parentIndex = newParent.children.findIndex(c => c.id === originalParent.id);
        if (parentIndex !== -1) {
            newParent.children.splice(parentIndex + 1, 0, targetNode);
        } else {
            newParent.children.push(targetNode);
        }

        const updateDepthRecursively = (node: D3Node, depth: number) => {
            node.depth = depth;
            const children = node.children || node._children || [];
            children.forEach(child => updateDepthRecursively(child, depth + 1));
        };
        updateDepthRecursively(targetNode, newParent.depth + 1);
    }),
    changeColors: (nodeIdToColorMap) => handleAction(tree => {
        nodeIdToColorMap.forEach((color, nodeId) => {
            const found = findNodeAndParent(tree, nodeId);
            if (!found) return;
            
            const applyColorToBranch = (node: D3Node, c: string | null) => {
                node.color = c || undefined;
                const children = node.children || node._children || [];
                children.forEach(child => applyColorToBranch(child, c));
            };
            applyColorToBranch(found.node, color);
        });
    }),
    updateNodeData: (nodeId, data) => handleAction(tree => {
        const found = findNodeAndParent(tree, nodeId);
        if (found) {
            Object.assign(found.node, data);
        }
    }),
    deleteNodes: (nodeIds) => handleAction(tree => {
        const nodesToDelete = nodeIds
            .map(id => findNodeAndParent(tree, id))
            .filter((found): found is { node: D3Node; parent: D3Node | null; } => !!found)
            .sort((a, b) => b.node.depth - a.node.depth);

        nodesToDelete.forEach(found => {
            if (found.node.id === tree.id || !found.parent) return; // Cannot delete root
            
            const { parent } = found;
            const children = parent.children || parent._children;
            if (children) {
                const index = children.findIndex(c => c.id === found.node.id);
                if (index > -1) children.splice(index, 1);
            }
        });
    }),
  }));

  return (
    <div ref={containerRef} className="not-prose w-full h-full rounded-lg overflow-hidden relative">
      {dimensions.width > 0 ? (
        <svg ref={svgRef}></svg>
      ) : (
        <div className="w-full h-full flex items-center justify-center text-text-secondary">
          Đang tải sơ đồ...
        </div>
      )}
    </div>
  );
});

export default MindMapView;