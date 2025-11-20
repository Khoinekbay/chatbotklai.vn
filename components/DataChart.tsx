
import React, { useEffect, useRef } from 'react';

interface DataChartProps {
  config: any;
}

declare global {
  interface Window {
    Chart: any;
  }
}

const DataChart: React.FC<DataChartProps> = ({ config }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartInstance = useRef<any>(null);

  useEffect(() => {
    if (!canvasRef.current || !window.Chart) return;

    // Destroy previous chart if exists
    if (chartInstance.current) {
      chartInstance.current.destroy();
    }

    const ctx = canvasRef.current.getContext('2d');
    if (ctx) {
      // Ensure responsive config
      const finalConfig = {
          ...config,
          options: {
              ...config.options,
              responsive: true,
              maintainAspectRatio: false,
              interaction: {
                  mode: 'index',
                  intersect: false,
              },
          }
      };

      try {
          chartInstance.current = new window.Chart(ctx, finalConfig);
      } catch (e) {
          console.error("Lỗi tạo biểu đồ:", e);
      }
    }

    return () => {
      if (chartInstance.current) {
        chartInstance.current.destroy();
      }
    };
  }, [config]);

  return (
    <div className="w-full h-80 bg-white dark:bg-slate-800 rounded-lg p-4 border border-border shadow-sm">
      <canvas ref={canvasRef} />
    </div>
  );
};

export default DataChart;
