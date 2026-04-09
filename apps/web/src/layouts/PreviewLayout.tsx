import { useState } from 'react';
import { Monitor, Smartphone, Tablet, ChevronLeft, Share2, Download } from 'lucide-react';

const channels = [
  { id: 'web', name: 'Web', icon: Monitor },
  { id: 'mobile', name: 'Mobile', icon: Smartphone },
  { id: 'tablet', name: 'Tablet', icon: Tablet },
];

const mockContent = {
  title: 'Getting Started with Our Platform',
  sections: [
    { type: 'heading', content: 'Welcome to the Platform' },
    { type: 'paragraph', content: 'This is a preview of your content. You can see how it will appear across different channels and devices.' },
    { type: 'list', items: ['Easy to use interface', 'Powerful features', 'Great support'] },
    { type: 'paragraph', content: 'Use the channel switcher above to see how your content adapts to different screen sizes and formats.' },
  ],
};

export default function PreviewLayout() {
  const [activeChannel, setActiveChannel] = useState('web');

  const getPreviewWidth = () => {
    switch (activeChannel) {
      case 'mobile': return 375;
      case 'tablet': return 768;
      default: return '100%';
    }
  };

  return (
    <div className="flex flex-col h-screen bg-[#0b0d14]">
      {/* Topbar */}
      <div className="px-6 py-3 bg-white/[0.03] border-b border-white/5 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <button className="bg-transparent border-none text-[#555870] cursor-pointer p-2">
            <ChevronLeft size={20} />
          </button>
          <h1 className="text-base font-semibold text-[#e2e4f0] m-0">Preview Mode</h1>
          <span className="text-white/20 mx-2">|</span>
          <span className="text-[13px] text-[#8b8fa8]">{mockContent.title}</span>
        </div>

        {/* Channel Switcher */}
        <div className="flex bg-white/5 rounded-lg p-1">
          {channels.map((channel) => (
            <button
              key={channel.id}
              onClick={() => setActiveChannel(channel.id)}
              className={`flex items-center gap-1.5 px-3 py-2 border-none rounded-md text-xs cursor-pointer ${
                activeChannel === channel.id
                  ? 'bg-violet-500/20 text-violet-400'
                  : 'bg-transparent text-[#555870]'
              }`}
            >
              <channel.icon size={14} />
              {channel.name}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <button className="flex items-center gap-1.5 px-3.5 py-2 bg-white/5 border border-white/10 rounded-md text-[#8b8fa8] text-xs cursor-pointer">
            <Download size={14} /> Export
          </button>
          <button className="flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-br from-violet-500 to-cyan-500 border-none rounded-md text-white text-xs font-semibold cursor-pointer">
            <Share2 size={14} /> Share
          </button>
        </div>
      </div>

      {/* Preview Canvas */}
      <div className="flex-1 overflow-auto p-10 flex justify-center bg-black/30">
        <div
          style={{ width: getPreviewWidth() }}
          className={`max-w-full bg-white overflow-hidden shadow-2xl ${activeChannel === 'web' ? 'rounded-none' : 'rounded-3xl'}`}
        >
          {/* Preview Header */}
          <div className="px-8 py-6 bg-gradient-to-br from-violet-500 to-cyan-500 text-white">
            <h1 className="text-2xl font-bold mb-2">{mockContent.title}</h1>
            <p className="text-[13px] opacity-80 m-0">Last updated: March 11, 2025</p>
          </div>

          {/* Preview Content */}
          <div className="p-8">
            {mockContent.sections.map((section, index) => {
              if (section.type === 'heading') {
                return (
                  <h2 key={index} className="text-xl font-semibold text-[#1a1d2e] mb-4">
                    {section.content}
                  </h2>
                );
              }
              if (section.type === 'paragraph') {
                return (
                  <p key={index} className="text-[15px] text-gray-600 leading-relaxed mb-4">
                    {section.content}
                  </p>
                );
              }
              if (section.type === 'list') {
                return (
                  <ul key={index} className="mb-4 ml-5 p-0">
                    {section.items?.map((item, i) => (
                      <li key={i} className="text-[15px] text-gray-600 leading-relaxed mb-2">
                        {item}
                      </li>
                    ))}
                  </ul>
                );
              }
              return null;
            })}
          </div>

          {/* Preview Footer */}
          <div className="px-8 py-5 border-t border-gray-200 bg-gray-50">
            <p className="text-xs text-gray-500 m-0">
              © 2025 CommsLib. All rights reserved.
            </p>
          </div>
        </div>
      </div>

      {/* Conditional Sections Panel */}
      <div className="w-[280px] bg-white/[0.03] border-l border-white/5 p-5 absolute right-0 top-[57px] bottom-0 overflow-y-auto">
        <h3 className="text-xs font-semibold text-[#e2e4f0] mb-4">
          Conditional Sections
        </h3>
        <div className="flex flex-col gap-3">
          {[
            { name: 'Introduction', enabled: true },
            { name: 'Getting Started', enabled: true },
            { name: 'Advanced Features', enabled: false },
            { name: 'FAQ', enabled: true },
            { name: 'Related Content', enabled: false },
          ].map((section) => (
            <label
              key={section.name}
              className="flex justify-between items-center px-3 py-2.5 bg-white/[0.03] rounded-md cursor-pointer"
            >
              <span className="text-xs text-[#8b8fa8]">{section.name}</span>
              <input
                type="checkbox"
                defaultChecked={section.enabled}
                className="accent-violet-500"
              />
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}
