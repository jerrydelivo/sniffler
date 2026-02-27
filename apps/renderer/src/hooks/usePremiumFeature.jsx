import { useState, useEffect } from "react";

// Hook to check if a feature is premium and handle premium feature restrictions
export function usePremiumFeature(featureName) {
  const [isPremium, setIsPremium] = useState(false);
  const [isFeatureLocked, setIsFeatureLocked] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkFeatureAccess();

    // Listen for license status changes
    const handleLicenseChange = (event) => {
      console.log(
        "Premium feature hook received license change:",
        event.detail
      );
      checkFeatureAccess();
    };

    window.addEventListener("licenseStatusChanged", handleLicenseChange);

    // Cleanup listener on unmount
    return () => {
      window.removeEventListener("licenseStatusChanged", handleLicenseChange);
    };
  }, [featureName]);

  const checkFeatureAccess = async () => {
    try {
      setLoading(true);

      // Check license status
      const licenseInfo = await window.electronAPI.getLicenseInfo();
      setIsPremium(licenseInfo.isPremium || licenseInfo.isTrial); // Include trial users

      // Check if this specific feature is premium-only
      const isFeaturePremium = await window.electronAPI.isPremiumFeature(
        featureName
      );
      setIsFeatureLocked(isFeaturePremium);
    } catch (error) {
      console.error("Failed to check feature access:", error);
      // Default to locked for safety
      setIsFeatureLocked(true);
      setIsPremium(false);
    } finally {
      setLoading(false);
    }
  };

  const refreshFeatureAccess = () => {
    checkFeatureAccess();
  };

  return {
    isPremium,
    isFeatureLocked,
    loading,
    canUseFeature: isPremium || !isFeatureLocked,
    refreshFeatureAccess,
  };
}

// Component to show premium feature restrictions
export function PremiumFeatureBlock({ feature, children, onUpgrade }) {
  const { canUseFeature, loading, isPremium } = usePremiumFeature(feature);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!canUseFeature) {
    return (
      <div className="bg-gradient-to-br from-blue-50 to-purple-50 border-2 border-dashed border-blue-300 rounded-lg p-8 text-center">
        <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
          <svg
            className="w-8 h-8 text-blue-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
            />
          </svg>
        </div>
        <h3 className="text-xl font-semibold text-gray-900 mb-2">
          Premium Feature
        </h3>
        <p className="text-gray-600 mb-6">
          This feature requires a premium license. Upgrade to unlock advanced
          functionality.
        </p>
        <div className="space-y-3">
          <button
            onClick={onUpgrade}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            Upgrade to Premium
          </button>
          <div className="text-sm text-gray-500">
            Or start your free 30-day trial
          </div>
        </div>
      </div>
    );
  }

  return children;
}

// Utility function to show premium upgrade prompt
export function showPremiumUpgradePrompt(feature) {
  const message = `This feature (${feature}) requires a premium license. Would you like to upgrade?`;

  if (confirm(message)) {
    // Navigate to license page or show upgrade modal
    // This would typically be handled by the parent component
    return true;
  }

  return false;
}

// Higher-order component to protect premium features
export function withPremiumCheck(WrappedComponent, featureName) {
  return function PremiumProtectedComponent(props) {
    const { canUseFeature, loading } = usePremiumFeature(featureName);

    const handleUpgrade = () => {
      // Navigate to license view
      if (props.onNavigateToLicense) {
        props.onNavigateToLicense();
      }
    };

    if (loading) {
      return (
        <div className="flex items-center justify-center p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      );
    }

    return (
      <PremiumFeatureBlock feature={featureName} onUpgrade={handleUpgrade}>
        <WrappedComponent {...props} />
      </PremiumFeatureBlock>
    );
  };
}
