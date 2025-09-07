import { useState } from 'react';
import { X, Upload, DollarSign, Clock, Shield, Image as ImageIcon } from 'lucide-react';
import type { AuctionParams, AssetType } from '../types/auction';

interface CreateAuctionFormProps {
  onClose: () => void;
  onSubmit: (auction: Omit<AuctionParams, 'appId' | 'created' | 'status' | 'oraclePk' | 'pHash'>) => void;
}

const assetTypes: { value: AssetType; label: string; icon: string }[] = [
  { value: 'NFT', label: 'NFT / Digital Collectible', icon: '🎨' },
  { value: 'RWA', label: 'Real World Asset', icon: '🏠' },
  { value: 'COMMODITY', label: 'Commodity (Gold, Silver, etc)', icon: '🥇' },
  { value: 'ART', label: 'Art & Creative Works', icon: '🖼️' },
  { value: 'TOKEN', label: 'Token / Cryptocurrency', icon: '🪙' },
  { value: 'REAL_ESTATE', label: 'Real Estate', icon: '🏢' },
  { value: 'OTHER', label: 'Other Assets', icon: '📦' }
];

export function CreateAuctionForm({ onClose, onSubmit }: CreateAuctionFormProps) {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    assetType: 'NFT' as AssetType,
    imageUrl: '',
    seller: '',
    asaId: 31566704, // Default to USDC
    reserve: '',
    minBid: '',
    bond: '1000000', // Default 1 ALGO
    secondPrice: true,
    commitEnd: '',
    unlockSlack: '50',
    payWindow: '100'
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.title.trim()) newErrors.title = 'Title is required';
    if (!formData.description.trim()) newErrors.description = 'Description is required';
    if (!formData.seller.trim()) newErrors.seller = 'Seller address is required';
    if (!formData.reserve || parseFloat(formData.reserve) <= 0) newErrors.reserve = 'Reserve price must be positive';
    if (!formData.minBid || parseFloat(formData.minBid) <= 0) newErrors.minBid = 'Min bid must be positive';
    if (!formData.commitEnd || parseInt(formData.commitEnd) <= 0) newErrors.commitEnd = 'Commit end round is required';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    const auctionData = {
      ...formData,
      asaId: parseInt(formData.asaId.toString()),
      reserve: Math.floor(parseFloat(formData.reserve) * 1000000), // Convert to microunits
      minBid: Math.floor(parseFloat(formData.minBid) * 1000000),
      bond: parseInt(formData.bond),
      commitEnd: parseInt(formData.commitEnd),
      unlockSlack: parseInt(formData.unlockSlack),
      payWindow: parseInt(formData.payWindow)
    };

    onSubmit(auctionData);
    onClose();
  };

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="glass-card max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-3xl font-bold gradient-text">Create New Auction</h2>
              <p className="text-slate-600 mt-2">Launch a sealed-bid auction for any asset type</p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
              <X className="w-6 h-6 text-slate-600" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Basic Info */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-semibold text-slate-900 mb-2">
                    Auction Title *
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => handleInputChange('title', e.target.value)}
                    placeholder="e.g., Rare Pepe #1337 or Manhattan Penthouse Shares"
                    className="bid-input"
                  />
                  {errors.title && <p className="text-red-600 text-sm mt-1">{errors.title}</p>}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-900 mb-2">
                    Asset Type *
                  </label>
                  <select
                    value={formData.assetType}
                    onChange={(e) => handleInputChange('assetType', e.target.value as AssetType)}
                    className="bid-input"
                  >
                    {assetTypes.map(type => (
                      <option key={type.value} value={type.value}>
                        {type.icon} {type.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-900 mb-2">
                    Description *
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => handleInputChange('description', e.target.value)}
                    placeholder="Detailed description of your asset..."
                    rows={4}
                    className="bid-input resize-none"
                  />
                  {errors.description && <p className="text-red-600 text-sm mt-1">{errors.description}</p>}
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-900 mb-2">
                  Asset Image URL
                </label>
                <div className="space-y-4">
                  <input
                    type="url"
                    value={formData.imageUrl}
                    onChange={(e) => handleInputChange('imageUrl', e.target.value)}
                    placeholder="https://example.com/image.jpg"
                    className="bid-input"
                  />
                  
                  {formData.imageUrl ? (
                    <div className="relative">
                      <img 
                        src={formData.imageUrl} 
                        alt="Preview" 
                        className="w-full h-48 object-cover rounded-lg"
                        onError={() => handleInputChange('imageUrl', '')}
                      />
                    </div>
                  ) : (
                    <div className="w-full h-48 bg-slate-100 rounded-lg flex items-center justify-center">
                      <div className="text-center text-slate-500">
                        <ImageIcon className="w-12 h-12 mx-auto mb-2" />
                        <p className="text-sm">Image preview will appear here</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Seller Info */}
            <div>
              <h3 className="text-xl font-bold text-slate-900 mb-4 flex items-center">
                <Shield className="w-5 h-5 mr-2" />
                Seller Information
              </h3>
              <div>
                <label className="block text-sm font-semibold text-slate-900 mb-2">
                  Seller Algorand Address *
                </label>
                <input
                  type="text"
                  value={formData.seller}
                  onChange={(e) => handleInputChange('seller', e.target.value)}
                  placeholder="YOUR7ALGORAND6ADDRESS4HERE3MNBVCXZ8QWERTY2UIOP5ASDFGH"
                  className="bid-input"
                />
                {errors.seller && <p className="text-red-600 text-sm mt-1">{errors.seller}</p>}
              </div>
            </div>

            {/* Auction Parameters */}
            <div>
              <h3 className="text-xl font-bold text-slate-900 mb-4 flex items-center">
                <DollarSign className="w-5 h-5 mr-2" />
                Auction Parameters
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-slate-900 mb-2">
                    Quote Asset
                  </label>
                  <select
                    value={formData.asaId}
                    onChange={(e) => handleInputChange('asaId', parseInt(e.target.value))}
                    className="bid-input"
                  >
                    <option value={31566704}>USDC (31566704)</option>
                    <option value={312769}>ALGO (312769)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-900 mb-2">
                    Reserve Price * {formData.asaId === 31566704 ? '(USDC)' : '(ALGO)'}
                  </label>
                  <input
                    type="number"
                    value={formData.reserve}
                    onChange={(e) => handleInputChange('reserve', e.target.value)}
                    placeholder="1000"
                    min="0"
                    step="0.000001"
                    className="bid-input"
                  />
                  {errors.reserve && <p className="text-red-600 text-sm mt-1">{errors.reserve}</p>}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-900 mb-2">
                    Suggested Min Bid * {formData.asaId === 31566704 ? '(USDC)' : '(ALGO)'}
                  </label>
                  <input
                    type="number"
                    value={formData.minBid}
                    onChange={(e) => handleInputChange('minBid', e.target.value)}
                    placeholder="500"
                    min="0"
                    step="0.000001"
                    className="bid-input"
                  />
                  {errors.minBid && <p className="text-red-600 text-sm mt-1">{errors.minBid}</p>}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-900 mb-2">
                    Anti-spam Bond (microALGO)
                  </label>
                  <select
                    value={formData.bond}
                    onChange={(e) => handleInputChange('bond', e.target.value)}
                    className="bid-input"
                  >
                    <option value="1000000">1 ALGO (small auctions)</option>
                    <option value="5000000">5 ALGO (medium auctions)</option>
                    <option value="10000000">10 ALGO (large auctions)</option>
                    <option value="50000000">50 ALGO (premium auctions)</option>
                    <option value="100000000">100 ALGO (high-value auctions)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-900 mb-2">
                    Auction Type
                  </label>
                  <select
                    value={formData.secondPrice.toString()}
                    onChange={(e) => handleInputChange('secondPrice', e.target.value === 'true')}
                    className="bid-input"
                  >
                    <option value="true">Second-Price (Winner pays 2nd highest)</option>
                    <option value="false">First-Price (Winner pays their bid)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Timing Parameters */}
            <div>
              <h3 className="text-xl font-bold text-slate-900 mb-4 flex items-center">
                <Clock className="w-5 h-5 mr-2" />
                Timing Parameters
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-slate-900 mb-2">
                    Commit End Round *
                  </label>
                  <input
                    type="number"
                    value={formData.commitEnd}
                    onChange={(e) => handleInputChange('commitEnd', e.target.value)}
                    placeholder="1000"
                    min="1"
                    className="bid-input"
                  />
                  {errors.commitEnd && <p className="text-red-600 text-sm mt-1">{errors.commitEnd}</p>}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-900 mb-2">
                    Reveal Window (rounds)
                  </label>
                  <input
                    type="number"
                    value={formData.unlockSlack}
                    onChange={(e) => handleInputChange('unlockSlack', e.target.value)}
                    placeholder="50"
                    min="10"
                    className="bid-input"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-900 mb-2">
                    Payment Window (rounds)
                  </label>
                  <input
                    type="number"
                    value={formData.payWindow}
                    onChange={(e) => handleInputChange('payWindow', e.target.value)}
                    placeholder="100"
                    min="10"
                    className="bid-input"
                  />
                </div>
              </div>
            </div>

            {/* Submit Buttons */}
            <div className="flex items-center justify-end space-x-4 pt-8 border-t border-slate-200">
              <button
                type="button"
                onClick={onClose}
                className="secondary-button"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="primary-button flex items-center space-x-2"
              >
                <Upload className="w-5 h-5" />
                <span>Create Auction</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}