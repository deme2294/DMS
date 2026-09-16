import AdminAnalytics from '../Analytics/AdminAnalytics';

export default function CeoAnalytics() {
  return (
    <AdminAnalytics
      title="Executive Analytics & Operations Intelligence"
      description="Organization-wide ticket lifecycle, priority allocation, creation vs resolution velocity, and department performance."
      badgeText="Executive Suite"
      isCeoView={true}
    />
  );
}
