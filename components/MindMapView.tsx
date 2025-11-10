import React, { useRef, useEffect, useState } from 'react';
import { type MindMapNode } from '../types';

// Add d3 to global scope to avoid TypeScript errors as types are not available.
declare const d3: any;

interface MindMapViewProps {
  data: MindMapNode;
}

// Augment the D3 node type with our custom properties.
// The original `extends d3.layout.tree.Node` is removed because d3 types are not available.
// All required properties used by d3 and the component logic are now explicitly defined.
interface D3Node {
  id?: number;
  _children?: D3Node[];
  children?: D3Node[];
  name: string;
  x0?: number;
  y0?: number;
  x: number;
  y: number;
  depth: number;
  parent?: D3Node;
}

let i = 0; // counter for unique node ids

const MindMapView: React.FC<MindMapViewProps> = ({ data }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    // Detect theme for styling
    const isDark = document.documentElement.classList.contains('dark');
    setTheme(isDark ? 'dark' : 'light');
  }, []);

  useEffect(() => {
    if (!svgRef.current || !data) return;

    const isDark = document.documentElement.classList.contains('dark');
    const colors = {
        bg: isDark ? 'var(--background)' : 'var(--model-bubble-bg)',
        text: 'var(--model-bubble-text)',
        link: isDark ? '#475569' : '#cbd5e1', // slate-600, slate-300
        nodeStroke: isDark ? '#64748b' : '#94a3b8', // slate-500, slate-400
        nodeFill: isDark ? 'var(--card)' : '#ffffff',
    };

    const margin = { top: 20, right: 120, bottom: 20, left: 120 };
    const width = 800 - margin.right - margin.left;
    const height = 600 - margin.top - margin.bottom;

    const tree = d3.layout.tree().size([height, width]);
    const diagonal = d3.svg.diagonal().projection((d: D3Node) => [d.y, d.x]);

    const svg = d3.select(svgRef.current)
      .html("") // Clear previous render
      .attr("width", width + margin.right + margin.left)
      .attr("height", height + margin.top + margin.bottom)
      .append("g")
      .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

    const root = data as D3Node;
    root.x0 = height / 2;
    root.y0 = 0;

    // Function to collapse all children
    const collapse = (d: D3Node) => {
        if (d.children) {
            d._children = d.children;
            d._children.forEach(collapse);
            d.children = undefined;
        }
    }

    if(root.children) root.children.forEach(collapse);
    
    const update = (source: D3Node) => {
        const duration = 500;

        // Compute the new tree layout.
        const nodes = tree.nodes(root).reverse();
        const links = tree.links(nodes);

        // Normalize for fixed-depth.
        nodes.forEach((d: D3Node) => { d.y = d.depth * 180; });

        // Update the nodes…
        const node = svg.selectAll("g.node")
            .data(nodes, (d: D3Node) => (d.id || (d.id = ++i)) as any);

        // Enter any new nodes at the parent's previous position.
        const nodeEnter = node.enter().append("g")
            .attr("class", "node")
            .attr("transform", () => `translate(${source.y0},${source.x0})`)
            .on("click", click);
        
        nodeEnter.append("circle")
            .attr("r", 1e-6)
            .style("fill", (d: D3Node) => d._children ? colors.nodeStroke : colors.nodeFill);

        nodeEnter.append("text")
            .attr("x", (d: D3Node) => d.children || d._children ? -13 : 13)
            .attr("dy", ".35em")
            .attr("text-anchor", (d: D3Node) => d.children || d._children ? "end" : "start")
            .text((d: D3Node) => d.name)
            .style("fill-opacity", 1e-6)
            .style("fill", colors.text)
            .style("font-size", "14px");

        // Transition nodes to their new position.
        const nodeUpdate = node.transition()
            .duration(duration)
            .attr("transform", (d: D3Node) => `translate(${d.y},${d.x})`);

        nodeUpdate.select("circle")
            .attr("r", 10)
            .style("stroke", colors.nodeStroke)
            .style("stroke-width", "1.5px")
            .style("fill", (d: D3Node) => d._children ? colors.nodeStroke : colors.nodeFill);

        nodeUpdate.select("text").style("fill-opacity", 1);

        // Transition exiting nodes to the parent's new position.
        const nodeExit = node.exit().transition()
            .duration(duration)
            .attr("transform", () => `translate(${source.y},${source.x})`)
            .remove();

        nodeExit.select("circle").attr("r", 1e-6);
        nodeExit.select("text").style("fill-opacity", 1e-6);

        // Update the links…
        const link = svg.selectAll("path.link")
            .data(links, (d: any) => d.target.id);

        // Enter any new links at the parent's previous position.
        link.enter().insert("path", "g")
            .attr("class", "link")
            .attr("d", () => {
                const o = { x: source.x0 ?? 0, y: source.y0 ?? 0 };
                return diagonal({ source: o, target: o });
            })
            .style("fill", "none")
            .style("stroke", colors.link)
            .style("stroke-width", "1.5px");

        // Transition links to their new position.
        link.transition()
            .duration(duration)
            .attr("d", diagonal);

        // Transition exiting nodes to the parent's new position.
        link.exit().transition()
            .duration(duration)
            .attr("d", () => {
                const o = { x: source.x, y: source.y };
                return diagonal({ source: o, target: o });
            })
            .remove();

        // Stash the old positions for transition.
        nodes.forEach((d: D3Node) => {
            d.x0 = d.x;
            d.y0 = d.y;
        });
    }

    // Toggle children on click.
    const click = (d: D3Node) => {
        if (d.children) {
            d._children = d.children;
            d.children = undefined;
        } else {
            d.children = d._children;
            d._children = undefined;
        }
        update(d);
    }
    
    update(root);

  }, [data, theme]);

  return (
    <div className="not-prose w-full h-full flex items-center justify-center">
      <svg ref={svgRef}></svg>
    </div>
  );
};

export default MindMapView;