type Action = {
  label?: string
  style?: string
  onPress?: () => void
}

export type ModalProps = {
  title?: string
  contentText?: string
  primaryAction?: Action
  secondaryAction?: Action
}
