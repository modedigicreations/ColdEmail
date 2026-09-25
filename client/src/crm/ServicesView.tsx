import React, { useState } from 'react';
import { PackageCheck, Sparkles, Tag, ArrowRight } from 'lucide-react';
import type { CRMService } from './crmTypes';
import { money } from './crmTypes';

interface ServicesViewProps {
  services: CRMService[];
  onSelectService?: (service: CRMService) => void;
  onSelectServiceForProposal?: (service: CRMService) => void;
}

export const ServicesView: React.FC<ServicesViewProps> = ({
  services,
  onSelectService,
  onSelectServiceForProposal
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const categories = ['all', ...Array.from(new Set(services.map(s => s.category)))];

  const filteredServices = services.filter(s => 
    selectedCategory === 'all' || s.category === selectedCategory
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ fontSize: '22px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <PackageCheck size={22} color="var(--primary)" /> Services & Pricing Catalog
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '2px' }}>
            Pre-defined agency service deliverables, commercial rates, retainers, and recurring care packages.
          </p>
        </div>
      </div>

      {/* Category Pills */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {categories.map(cat => (
          <button
            key={cat}
            className={`btn ${selectedCategory === cat ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '6px 14px', fontSize: '12px', textTransform: 'capitalize' }}
            onClick={() => setSelectedCategory(cat)}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Services Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
        {filteredServices.map(service => (
          <div 
            key={service.id} 
            className="glass-card" 
            style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              justifyContent: 'space-between', 
              gap: '14px', 
              padding: '20px',
              position: 'relative'
            }}
          >
            <div>
              {/* Category & Recommended Badge */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <Tag size={11} /> {service.category}
                </span>

                {service.recommended && (
                  <span style={{ 
                    fontSize: '10px', 
                    background: 'rgba(192, 132, 252, 0.15)', 
                    color: '#c084fc', 
                    border: '1px solid rgba(192, 132, 252, 0.3)', 
                    padding: '2px 8px', 
                    borderRadius: '12px',
                    fontWeight: 600,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}>
                    <Sparkles size={10} /> Popular
                  </span>
                )}
              </div>

              {/* Title & Description */}
              <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '6px' }}>
                {service.name}
              </h3>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                {service.description}
              </p>
            </div>

            {/* Price & Action */}
            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: '18px', fontWeight: 800, color: 'var(--success)' }}>
                  {money(service.price)}
                </span>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginLeft: '4px' }}>
                  / {service.unit}
                </span>
              </div>

              {(onSelectService || onSelectServiceForProposal) && (
                <button 
                  className="btn btn-secondary" 
                  style={{ padding: '6px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}
                  onClick={() => (onSelectService ? onSelectService(service) : onSelectServiceForProposal?.(service))}
                >
                  Add to Proposal <ArrowRight size={12} />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
