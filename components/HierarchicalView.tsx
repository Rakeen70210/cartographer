import { ProgressIndicator } from '@/components/ProgressIndicator';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useThemeColor } from '@/hooks/useThemeColor';
import { useCallback } from 'react';
import { FlatList, StyleSheet, TouchableOpacity, View } from 'react-native';

export interface GeographicHierarchy {
  type: 'country' | 'state' | 'city';
  name: string;
  code?: string;
  explorationPercentage: number;
  totalArea?: number;
  exploredArea?: number;
  children?: GeographicHierarchy[];
  isExpanded?: boolean;
  id: string; // Unique identifier for the item
}

export interface HierarchicalViewProps {
  data: GeographicHierarchy[];
  onToggleExpand: (item: GeographicHierarchy) => void;
  maxDepth?: number;
  showProgressBars?: boolean;
  testID?: string;
}

interface FlattenedItem extends GeographicHierarchy {
  depth: number;
  parentId?: string;
}

export function HierarchicalView({
  data,
  onToggleExpand,
  maxDepth = 3,
  showProgressBars = true,
  testID,
}: HierarchicalViewProps) {
  const borderColor = useThemeColor({ light: '#E5E7EB', dark: '#374151' }, 'text');
  const secondaryTextColor = useThemeColor({ light: '#6B7280', dark: '#D1D5DB' }, 'text');
  const expandIconColor = useThemeColor({}, 'tint');

  // Flatten the hierarchical data for FlatList rendering
  const flattenData = useCallback((items: GeographicHierarchy[], depth = 0, parentId?: string): FlattenedItem[] => {
    if (depth >= maxDepth || !items) return [];
    
    const flattened: FlattenedItem[] = [];
    
    items.forEach((item) => {
      flattened.push({
        ...item,
        depth,
        parentId,
      });
      
      if (item.isExpanded && item.children && item.children.length > 0) {
        flattened.push(...flattenData(item.children, depth + 1, item.id));
      }
    });
    
    return flattened;
  }, [maxDepth]);

  const flattenedData = flattenData(data);

  const getIndentationStyle = (depth: number) => ({
    marginLeft: depth * 20,
  });

  const getExpandIcon = (item: FlattenedItem) => {
    if (!item.children || item.children.length === 0) {
      return '•'; // Bullet for leaf nodes
    }
    return item.isExpanded ? '▼' : '▶'; // Down arrow for expanded, right arrow for collapsed
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'country':
        return '🌍';
      case 'state':
        return '🏛️';
      case 'city':
        return '🏙️';
      default:
        return '📍';
    }
  };

  const formatPercentage = (percentage: number) => {
    if (percentage < 0.1) {
      return percentage.toFixed(3) + '%';
    } else if (percentage < 1) {
      return percentage.toFixed(2) + '%';
    } else {
      return percentage.toFixed(1) + '%';
    }
  };

  const renderItem = ({ item }: { item: FlattenedItem }) => {
    const hasChildren = item.children && item.children.length > 0;
    const isExpandable = hasChildren && item.depth < maxDepth - 1;

    return (
      <ThemedView style={[styles.itemContainer, { borderBottomColor: borderColor }]}>
        <TouchableOpacity
          style={[styles.itemContent, getIndentationStyle(item.depth)]}
          onPress={() => isExpandable ? onToggleExpand(item) : undefined}
          disabled={!isExpandable}
          accessible={true}
          accessibilityRole={isExpandable ? 'button' : 'text'}
          accessibilityLabel={`${item.name}, ${formatPercentage(item.explorationPercentage)} explored`}
          accessibilityHint={isExpandable ? (item.isExpanded ? 'Tap to collapse' : 'Tap to expand') : undefined}
          testID={`hierarchical-item-${item.id}`}
        >
          <View style={styles.itemHeader}>
            <ThemedText 
              style={[
                styles.expandIcon, 
                { color: isExpandable ? expandIconColor : secondaryTextColor }
              ]}
              accessibilityLabel={`${item.isExpanded ? 'Expanded' : 'Collapsed'} ${item.type}`}
            >
              {getExpandIcon(item)}
            </ThemedText>
            
            <ThemedText style={styles.typeIcon}>
              {getTypeIcon(item.type)}
            </ThemedText>
            
            <View style={styles.itemInfo}>
              <ThemedText 
                style={[
                  styles.itemName,
                  item.depth === 0 && styles.primaryItemName,
                  item.depth === 1 && styles.secondaryItemName,
                ]}
                numberOfLines={1}
              >
                {item.name}
                {item.code && (
                  <ThemedText style={[styles.itemCode, { color: secondaryTextColor }]}>
                    {' '}({item.code})
                  </ThemedText>
                )}
              </ThemedText>
              
              <ThemedText 
                style={[styles.percentage, { color: secondaryTextColor }]}
                accessibilityLabel={`${formatPercentage(item.explorationPercentage)} explored`}
              >
                {formatPercentage(item.explorationPercentage)}
              </ThemedText>
            </View>
          </View>
          
          {showProgressBars && (
            <View style={[styles.progressContainer, getIndentationStyle(item.depth + 1)]}>
              <ProgressIndicator
                percentage={item.explorationPercentage}
                style="bar"
                size="small"
                animated={false}
                testID={`progress-${item.id}`}
              />
            </View>
          )}
        </TouchableOpacity>
      </ThemedView>
    );
  };

  const keyExtractor = (item: FlattenedItem) => item.id;

  const getItemLayout = (_: any, index: number) => ({
    length: showProgressBars ? 70 : 50,
    offset: (showProgressBars ? 70 : 50) * index,
    index,
  });

  if (!data || data.length === 0) {
    return (
      <ThemedView 
        style={styles.emptyContainer}
        testID={testID}
      >
        <ThemedText style={[styles.emptyText, { color: secondaryTextColor }]}>
          No geographic data available
        </ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView 
      style={styles.container}
      accessible={true}
      accessibilityRole="list"
      accessibilityLabel="Geographic exploration hierarchy"
      testID={testID}
    >
      <FlatList
        data={flattenedData}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        getItemLayout={getItemLayout}
        removeClippedSubviews={true}
        maxToRenderPerBatch={10}
        windowSize={10}
        initialNumToRender={10}
        showsVerticalScrollIndicator={true}
        style={styles.list}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    borderRadius: 8,
    overflow: 'hidden',
  },
  list: {
    flex: 1,
  },
  itemContainer: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  itemContent: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  expandIcon: {
    fontSize: 12,
    width: 16,
    textAlign: 'center',
    marginRight: 8,
  },
  typeIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  itemInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  itemName: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  primaryItemName: {
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryItemName: {
    fontSize: 15,
    fontWeight: '500',
  },
  itemCode: {
    fontSize: 12,
    fontWeight: 'normal',
  },
  percentage: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 8,
    minWidth: 50,
    textAlign: 'right',
  },
  progressContainer: {
    marginTop: 4,
    marginRight: 8,
  },
  emptyContainer: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 100,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
  },
});