import React, { useState, useEffect } from 'react';
import {
  Page, Card, BlockStack, InlineStack, Text, Banner,
  Spinner, Divider, Button, Badge, Box, EmptyState
} from '@shopify/polaris';
import { OrderIcon } from '@shopify/polaris-icons';
import { useDashboard } from '../DashboardContext';
import { useI18n } from '../../../i18n/I18nContext';


interface OrderItem {
  title: string; quantity: number; price: string;
}

interface Order {
  id: number; name: string; email: string; createdAt: string;
  totalPrice: string; currency: string;
  financialStatus: string; fulfillmentStatus: string | null;
  itemCount: number; items: OrderItem[];
  customer: { name: string; email: string };
  shippingAddress: { city: string; province: string; country: string } | null;
}

type View = 'list' | 'detail';

interface Props { onBack: () => void; }

export const OrdersPage: React.FC<Props> = ({ onBack }) => {
  const { shop, token } = useDashboard();
  const { t } = useI18n();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [view, setView] = useState<View>('list');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [fulfilling, setFulfilling] = useState(false);

  const fetchOrders = async () => {
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/orders/list', {
        headers: { 'x-shopify-domain': shop, 'x-shopify-token': token },
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'Failed to load orders');
      setOrders(data.orders || []);
    } catch (err: any) { setError(err.message); }
    setLoading(false);
  };



  useEffect(() => { fetchOrders(); }, [shop, token]);

  const openOrder = (o: Order) => { setSelectedOrder(o); setView('detail'); };

  const handleFulfill = async () => {
    if (!selectedOrder) return;
    setFulfilling(true); setError('');
    try {
      const res = await fetch('/api/orders/fulfill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-shopify-domain': shop, 'x-shopify-token': token },
        body: JSON.stringify({ orderId: selectedOrder.id }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'Failed to fulfill');
      // Update local state
      setSelectedOrder({ ...selectedOrder, fulfillmentStatus: 'fulfilled' });
      setOrders(prev => prev.map(o => o.id === selectedOrder.id ? { ...o, fulfillmentStatus: 'fulfilled' } : o));
    } catch (err: any) { setError(err.message); }
    setFulfilling(false);
  };

  const formatDate = (d: string) => new Date(d).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });

  if (view === 'detail' && selectedOrder) {
    const isUnfulfilled = !selectedOrder.fulfillmentStatus || selectedOrder.fulfillmentStatus === 'unfulfilled';

    return (
      <Page 
        backAction={{ content: t('orders.title'), onAction: () => setView('list') }}
        title={`Order ${selectedOrder.name}`}
      >
        <div className="simplified-container">
          <BlockStack gap="400">
            {error && <Banner tone="critical" onDismiss={() => setError('')}><p>{error}</p></Banner>}

            <Card>
              <BlockStack gap="400">
                <InlineStack align="space-between" blockAlign="center">
                  <Text as="h2" variant="headingMd">{t('orders.details')}</Text>
                  <InlineStack gap="200">
                    <Badge tone={selectedOrder.financialStatus === 'paid' ? 'success' : 'warning'}>
                      {selectedOrder.financialStatus === 'paid' ? t('orders.paid') : t('orders.unpaid')}
                    </Badge>
                    <Badge tone={isUnfulfilled ? 'critical' : 'success'}>
                      {isUnfulfilled ? t('orders.unfulfilled') : t('orders.shipped')}
                    </Badge>
                  </InlineStack>
                </InlineStack>
                <div style={{ display: 'flex', gap: '32px', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <Text as="h3" variant="headingSm" tone="subdued">{t('orders.customer')}</Text>
                    <Box paddingBlockStart="100">
                      <Text as="p" variant="bodyMd" fontWeight="medium">{selectedOrder.customer?.name || 'Guest'}</Text>
                      <Text as="p" tone="subdued">{selectedOrder.customer?.email || 'No email'}</Text>
                    </Box>
                  </div>
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <Text as="h3" variant="headingSm" tone="subdued">{t('orders.shippingAddress')}</Text>
                    <Box paddingBlockStart="100">
                      <Text as="p" variant="bodyMd">
                        {selectedOrder.shippingAddress 
                          ? `${selectedOrder.shippingAddress.city}, ${selectedOrder.shippingAddress.province}, ${selectedOrder.shippingAddress.country}`
                          : 'No shipping address'}
                      </Text>
                    </Box>
                  </div>
                </div>
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">{t('orders.items')} ({selectedOrder.itemCount})</Text>
                <Divider />
                <BlockStack gap="300">
                  {selectedOrder.items.map((item, i) => (
                    <InlineStack key={i} align="space-between">
                      <Text as="p">{item.title} <Text as="span" tone="subdued">× {item.quantity}</Text></Text>
                      <Text as="p">{selectedOrder.currency} {item.price}</Text>
                    </InlineStack>
                  ))}
                </BlockStack>
                <Divider />
                <InlineStack align="space-between" blockAlign="center">
                  <Text as="h3" variant="headingMd">{t('orders.totalLabel')}</Text>
                  <Text as="h3" variant="headingMd">${selectedOrder.totalPrice} {selectedOrder.currency}</Text>
                </InlineStack>
              </BlockStack>
            </Card>

            {isUnfulfilled && (
              <VoiceHint label={t('orders.markShipped')}>
                <Box paddingBlockStart="200">
                  <Button 
                    variant="primary" 
                    size="large" 
                    tone="success" 
                    fullWidth 
                    loading={fulfilling} 
                    onClick={handleFulfill}
                  >
                    {t('orders.markShipped')}
                  </Button>
                </Box>
              </VoiceHint>
            )}
          </BlockStack>
        </div>
      </Page>
    );
  }

  return (
    <Page 
      backAction={{ content: 'Home', onAction: onBack }}
      title={t('orders.title')}
      primaryAction={<Button onClick={fetchOrders} disabled={loading}>{t('orders.refresh')}</Button>}
    >
      <div className="simplified-container">
        <BlockStack gap="400">
          {error && <Banner tone="critical" onDismiss={() => setError('')}><p>{error}</p></Banner>}

          <InlineStack align="space-between" blockAlign="center">
            <Card>
              <BlockStack inlineAlign="center" gap="100">
                <Text as="p" tone="subdued" variant="bodySm">{t('orders.total')}</Text>
                <Text as="p" variant="headingLg">{orders.length}</Text>
              </BlockStack>
            </Card>
            <Card>
              <BlockStack inlineAlign="center" gap="100">
                <Text as="p" tone="subdued" variant="bodySm">{t('orders.toShip')}</Text>
                <Text as="p" variant="headingLg" tone="critical">
                  {orders.filter(o => !o.fulfillmentStatus || o.fulfillmentStatus === 'unfulfilled').length}
                </Text>
              </BlockStack>
            </Card>
          </InlineStack>

          {loading && !orders.length ? (
            <Card>
              <Box padding="800">
                <BlockStack inlineAlign="center" gap="400">
                  <Spinner size="large" />
                  <Text as="p" alignment="center">{t('orders.loading')}</Text>
                </BlockStack>
              </Box>
            </Card>
          ) : orders.length === 0 ? (
            <Card>
              <EmptyState
                heading={t('orders.empty')}
                action={{ content: t('orders.refresh'), onAction: fetchOrders }}
                image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
              >
                <p>{t('orders.emptyDesc')}</p>
              </EmptyState>
            </Card>
          ) : (
            <div id="tour-step-order-list">
              <BlockStack gap="400">
                <Card>
                  <InlineStack align="space-evenly" blockAlign="center">
                    <BlockStack inlineAlign="center">
                      <Text as="h2" variant="headingXl">{orders.length}</Text>
                      <Text as="p" tone="subdued">Total Orders</Text>
                    </BlockStack>
                    <div style={{ width: '1px', backgroundColor: '#e1e3e5', height: '40px' }} />
                    <BlockStack inlineAlign="center">
                      <Text as="h2" variant="headingXl" tone="critical">
                        {orders.filter(o => !o.fulfillmentStatus || o.fulfillmentStatus === 'unfulfilled').length}
                      </Text>
                      <Text as="p" tone="subdued">To Ship</Text>
                    </BlockStack>
                  </InlineStack>
                </Card>

                {orders.map(o => {
                  const isUnfulfilled = !o.fulfillmentStatus || o.fulfillmentStatus === 'unfulfilled';
                  return (
                    <VoiceHint key={o.id} label={`Order ${o.name}, ${o.customer.name}`}>
                      <div style={{ cursor: 'pointer' }} onClick={() => openOrder(o)}>
                        <Card>
                          <InlineStack align="space-between" blockAlign="center">
                            <BlockStack gap="100">
                              <InlineStack gap="200" blockAlign="center">
                                <Text as="h3" variant="headingMd">{o.name}</Text>
                                <Badge tone={isUnfulfilled ? 'critical' : 'success'}>
                                  {isUnfulfilled ? 'Unfulfilled' : 'Shipped'}
                                </Badge>
                              </InlineStack>
                              <Text as="p" tone="subdued">
                                {o.customer.name} • {o.itemCount} item{o.itemCount !== 1 ? 's' : ''}
                              </Text>
                            </BlockStack>
                            <BlockStack inlineAlign="end" gap="100">
                              <Text as="p" fontWeight="bold">{o.currency} {o.totalPrice}</Text>
                              <Text as="p" tone="subdued" variant="bodySm">{formatDate(o.createdAt)}</Text>
                            </BlockStack>
                          </InlineStack>
                        </Card>
                      </div>
                    </VoiceHint>
                  );
                })}
              </BlockStack>
            </div>
          )}
        </BlockStack>
      </div>
    </Page>
  );
};
